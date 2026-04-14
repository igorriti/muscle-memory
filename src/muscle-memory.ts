import { generateText } from 'ai';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { Store, Trace, TraceStep, ToolRegistry, Template, DEFAULT_CONFIG, MithrilConfig } from './types.js';
import { SqliteStore } from './store.js';
import { IntentMatcher } from './executor/intent-matcher.js';
import { ArgExtractor } from './executor/arg-extractor.js';
import { walkGraph } from './executor/graph-walker.js';
import { Tracer } from './tracer.js';

export interface MuscleMemoryConfig {
  /** Phase 1: the "thinker" model. Any AI SDK model. */
  model: any;
  /** Phase 3: the "extractor" model (cheap/small). Any AI SDK model. Optional — skips SLM if regex works. */
  extractionModel?: any;
  /** AI SDK embedding model for similarity matching. Optional — skips embedding if not set. */
  embeddingModel?: any;
  /** AI SDK tools — same format you already use with generateText. */
  tools: Record<string, any>;
  /** Where to persist traces and templates. Default: SqliteStore('./muscle-memory.db') */
  store?: Store;
  /** System prompt for Phase 1. */
  system?: string;
  /** Min traces before learning. Default: 3 */
  minTraces?: number;
  /** Confidence threshold for Phase 3. Default: 0.90 */
  confidence?: number;
  /** Similarity threshold for template matching. Default: 0.85 */
  similarity?: number;
}

function toRegistry(tools: Record<string, any>): ToolRegistry {
  const registry: ToolRegistry = {};
  for (const [name, def] of Object.entries(tools)) {
    registry[name] = {
      name,
      description: def.description ?? '',
      inputSchema: def.inputSchema ?? def.parameters ?? z.object({}),
      outputSchema: z.any(),
      execute: def.execute ?? (async () => ({})),
      idempotent: false,
      timeoutMs: 30000,
      retries: 0,
    };
  }
  return registry;
}

function extractPrompt(params: any): string {
  if (typeof params.prompt === 'string') return params.prompt;
  if (params.messages) {
    const last = params.messages[params.messages.length - 1];
    if (typeof last === 'string') return last;
    if (last?.content) return typeof last.content === 'string' ? last.content : JSON.stringify(last.content);
  }
  return '';
}

export function muscleMemory(userConfig: MuscleMemoryConfig) {
  const store = userConfig.store ?? new SqliteStore('./muscle-memory.db');

  const config: MithrilConfig = {
    ...DEFAULT_CONFIG,
    plannerModel: userConfig.model,
    extractorModel: userConfig.extractionModel ?? userConfig.model,
    embeddingModel: userConfig.embeddingModel ?? null,
    systemPrompt: userConfig.system ?? DEFAULT_CONFIG.systemPrompt,
    minTracesForTemplate: userConfig.minTraces ?? DEFAULT_CONFIG.minTracesForTemplate,
    confidenceThreshold: userConfig.confidence ?? DEFAULT_CONFIG.confidenceThreshold,
    similarityThreshold: userConfig.similarity ?? DEFAULT_CONFIG.similarityThreshold,
  };

  const toolRegistry = toRegistry(userConfig.tools);
  const matcher = new IntentMatcher(store, config);
  const extractor = new ArgExtractor(config);
  const tracer = new Tracer(store, config);
  matcher.reload();

  return {
    async run(params: { messages?: any[]; prompt?: string }): Promise<{
      text: string;
      phase: 1 | 3;
      traceId: string;
      latencyMs: number;
      costUsd: number;
    }> {
      const startTime = Date.now();
      const prompt = extractPrompt(params);
      if (!prompt) throw new Error('No prompt or messages provided');

      // ── Try Phase 3 ──
      const match = await matcher.match(prompt);

      if (match && match.similarity >= config.similarityThreshold) {
        const template = store.getTemplate(match.templateId);

        if (template && template.status === 'active' && template.confidence >= config.confidenceThreshold) {
          const extraction = await extractor.extract(prompt, template.argSchema);

          if (extraction.allRequiredPresent) {
            const { text, trace } = await walkGraph(
              template.graph,
              extraction.args,
              toolRegistry,
              prompt,
              template.templateId,
            );

            store.updateTemplateAfterExecution(template.templateId, trace.success);
            await tracer.save(trace);

            store.logRouting({
              userMessage: prompt,
              phase: 3,
              reason: `Template match (sim=${match.similarity.toFixed(3)}, conf=${template.confidence.toFixed(3)})`,
              templateId: template.templateId,
              similarity: match.similarity,
              confidence: template.confidence,
              latencyMs: Date.now() - startTime,
              costUsd: 0.001,
              success: trace.success,
            });

            return {
              text,
              phase: 3,
              traceId: trace.traceId,
              latencyMs: Date.now() - startTime,
              costUsd: 0.001,
            };
          }
        }
      }

      // ── Phase 1: full LLM via AI SDK ──
      const aiTools: Record<string, any> = {};
      for (const [name, def] of Object.entries(userConfig.tools)) {
        // Pass through AI SDK tools as-is
        aiTools[name] = def;
      }

      const result = await generateText({
        model: userConfig.model,
        system: userConfig.system,
        tools: aiTools,
        prompt: params.prompt,
        messages: params.messages,
        maxSteps: 10,
      } as any);

      // Build trace
      const steps: TraceStep[] = [];
      let stepId = 0;
      for (const step of (result as any).steps ?? []) {
        for (const tc of (step.toolCalls ?? [])) {
          const tr = (step.toolResults ?? []).find((r: any) => r.toolCallId === tc.toolCallId);
          steps.push({
            stepId: stepId++,
            toolName: tc.toolName,
            toolInput: tc.input ?? tc.args ?? {},
            toolOutput: tr?.output ?? tr?.result ?? {},
            latencyMs: 0,
            success: tr ? !tr.isError : true,
            dependsOn: stepId > 1 ? stepId - 2 : null,
          });
        }
      }

      const usage = (result as any).usage;
      const costUsd = usage
        ? ((usage.inputTokens ?? usage.promptTokens ?? 0) * 1 + (usage.outputTokens ?? usage.completionTokens ?? 0) * 4) / 1_000_000
        : 0;

      const trace: Trace = {
        traceId: uuid(),
        timestamp: new Date().toISOString(),
        userMessage: prompt,
        userMessageEmbedding: null,
        steps,
        finalResponse: result.text,
        totalTokens: usage?.totalTokens ?? 0,
        totalCostUsd: costUsd,
        totalLatencyMs: Date.now() - startTime,
        success: true,
        phase: 1,
        templateId: null,
        routingReason: 'No template match',
      };

      await tracer.save(trace);

      store.logRouting({
        userMessage: prompt,
        phase: 1,
        reason: match ? `Below thresholds` : 'No template match',
        latencyMs: trace.totalLatencyMs,
        costUsd,
        success: true,
      });

      return {
        text: result.text,
        phase: 1,
        traceId: trace.traceId,
        latencyMs: Date.now() - startTime,
        costUsd,
      };
    },

    async learn() {
      const { runLearningPipeline } = await import('./learner/pipeline.js');
      const result = await runLearningPipeline(store, config, {});
      matcher.reload();
      return result;
    },

    metrics() {
      return store.getMetrics();
    },

    invalidate(templateId: string) {
      store.degradeTemplate(templateId);
      matcher.reload();
    },
  };
}
