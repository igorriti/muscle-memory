import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { SqliteStore } from './store.js';
import { IntentMatcher } from './executor/intent-matcher.js';
import { ArgExtractor } from './executor/arg-extractor.js';
import { walkGraph } from './executor/graph-walker.js';
import { Tracer } from './tracer.js';
import { DEFAULT_CONFIG, MithrilConfig, Trace, TraceStep, ToolRegistry, Store } from './types.js';

// ════════════════════════════════════════════
//  PUBLIC TYPES
// ════════════════════════════════════════════

export interface MemoryOptions {
  /** Path to SQLite database. Default: './muscle-memory.db' */
  db?: string;
  /** AI SDK embedding model. Optional — skips embedding if not set. */
  embeddingModel?: any;
  /** AI SDK extractor model (small/cheap). Optional — skips SLM extraction if not set. */
  extractorModel?: any;
  /** Min successful traces before learning a template. Default: 3 */
  minTraces?: number;
  /** Confidence threshold for Phase 3. Default: 0.90 */
  confidence?: number;
  /** Similarity threshold for template matching. Default: 0.85 */
  similarity?: number;
}

export interface MithrilMeta {
  phase: 1 | 3;
  latencyMs: number;
  costUsd: number;
  traceId: string;
  templateId?: string;
}

// ════════════════════════════════════════════
//  INTERNALS
// ════════════════════════════════════════════

/** Convert AI SDK tool definitions to internal ToolRegistry */
function toRegistry(tools: Record<string, any> | undefined): ToolRegistry {
  const registry: ToolRegistry = {};
  if (!tools) return registry;
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

/** Extract the user's prompt as a string from AI SDK params */
function extractPrompt(params: any): string {
  if (typeof params.prompt === 'string') return params.prompt;
  if (params.messages) {
    const last = params.messages[params.messages.length - 1];
    if (typeof last === 'string') return last;
    if (last?.content) return typeof last.content === 'string' ? last.content : JSON.stringify(last.content);
  }
  return '';
}

/** Build a trace from an AI SDK generateText result */
function buildTrace(prompt: string, result: any, startTime: number): Trace {
  const steps: TraceStep[] = [];
  let stepId = 0;

  for (const step of (result.steps ?? [])) {
    for (const tc of (step.toolCalls ?? [])) {
      const tr = step.toolResults?.find((r: any) => r.toolCallId === tc.toolCallId);
      steps.push({
        stepId: stepId++,
        toolName: tc.toolName,
        toolInput: tc.input ?? tc.args ?? {},
        toolOutput: tr?.output ?? tr?.result ?? {},
        latencyMs: 0,
        success: tr ? !(tr as any).isError : true,
        dependsOn: stepId > 1 ? stepId - 2 : null,
      });
    }
  }

  const usage = result.usage as any;
  const inputCost = (usage?.inputTokens ?? usage?.promptTokens ?? 0) * 1 / 1_000_000;
  const outputCost = (usage?.outputTokens ?? usage?.completionTokens ?? 0) * 4 / 1_000_000;

  return {
    traceId: uuid(),
    timestamp: new Date().toISOString(),
    userMessage: prompt,
    userMessageEmbedding: null,
    steps,
    finalResponse: result.text ?? '',
    totalTokens: usage?.totalTokens ?? 0,
    totalCostUsd: inputCost + outputCost,
    totalLatencyMs: Date.now() - startTime,
    success: true,
    phase: 1,
    templateId: null,
    routingReason: 'No template match',
  };
}

// ════════════════════════════════════════════
//  withMemory()
// ════════════════════════════════════════════

/**
 * Wrap AI SDK's `generateText` with automatic learning.
 *
 * ```typescript
 * import { generateText } from 'ai';
 * import { withMemory } from 'muscle-memory-ai';
 *
 * const generate = withMemory(generateText);
 *
 * // Same API as generateText — but it learns.
 * const result = await generate({ model, tools, prompt });
 * result.text;                          // always works
 * result.experimental_muscle_memory?.phase;   // 1 or 3
 * ```
 */
export function withMemory<T extends (...args: any[]) => Promise<any>>(
  generateTextFn: T,
  options: MemoryOptions = {},
) {
  const config: MithrilConfig = {
    ...DEFAULT_CONFIG,
    embeddingModel: options.embeddingModel ?? null,
    extractorModel: options.extractorModel ?? null,
    dbPath: options.db ?? DEFAULT_CONFIG.dbPath,
    minTracesForTemplate: options.minTraces ?? DEFAULT_CONFIG.minTracesForTemplate,
    confidenceThreshold: options.confidence ?? DEFAULT_CONFIG.confidenceThreshold,
    similarityThreshold: options.similarity ?? DEFAULT_CONFIG.similarityThreshold,
  };

  const store = new SqliteStore(options.db ?? './muscle-memory.db');
  const matcher = new IntentMatcher(store, config);
  const extractor = new ArgExtractor(config);
  const tracer = new Tracer(store, config);
  matcher.reload();

  // ── The wrapped function ──

  async function generate(params: any): Promise<any> {
    const startTime = Date.now();
    const prompt = extractPrompt(params);
    if (!prompt) return generateTextFn(params);

    const tools = toRegistry(params.tools);

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
            tools,
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

          // Return AI SDK-shaped result
          return {
            text,
            toolCalls: [],
            toolResults: [],
            finishReason: 'stop',
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            steps: [],
            warnings: [],
            response: { id: trace.traceId, modelId: 'muscle-memory-phase3' },
            experimental_muscle_memory: {
              phase: 3 as const,
              latencyMs: Date.now() - startTime,
              costUsd: 0.001,
              traceId: trace.traceId,
              templateId: template.templateId,
            } satisfies MithrilMeta,
          };
        }
      }
    }

    // ── Phase 1: pass through ──
    const result = await generateTextFn(params);
    const trace = buildTrace(prompt, result, startTime);
    await tracer.save(trace);

    store.logRouting({
      userMessage: prompt,
      phase: 1,
      reason: match ? `Below thresholds (sim=${match.similarity.toFixed(3)})` : 'No template match',
      latencyMs: trace.totalLatencyMs,
      costUsd: trace.totalCostUsd,
      success: true,
    });

    // Return original result + muscle-memory metadata
    result.experimental_muscle_memory = {
      phase: 1 as const,
      latencyMs: trace.totalLatencyMs,
      costUsd: trace.totalCostUsd,
      traceId: trace.traceId,
    } satisfies MithrilMeta;

    return result;
  }

  // ── Utility methods ──

  /** Trigger the learning pipeline. Analyzes traces and creates templates. */
  generate.learn = async () => {
    const { runLearningPipeline } = await import('./learner/pipeline.js');
    const result = await runLearningPipeline(store, config, {});
    matcher.reload();
    return result;
  };

  /** Get execution metrics: total traces, phase distribution, costs. */
  generate.metrics = () => store.getMetrics();

  /** Manually invalidate a template (e.g. after an API change). */
  generate.invalidate = (templateId: string) => {
    store.degradeTemplate(templateId);
    matcher.reload();
  };

  return generate;
}

// ════════════════════════════════════════════
//  Standalone learn() for background jobs
// ════════════════════════════════════════════

export interface LearnOptions {
  /** Path to SQLite database. Must match the one used by withMemory. */
  db?: string;
  /** Min traces in a cluster before creating a template. Default: 3 */
  minTraces?: number;
  /** Confidence threshold. Default: 0.90 */
  confidence?: number;
}

/**
 * Run the learning pipeline as a standalone operation.
 * Use this in a cron job, background worker, or script.
 *
 * ```typescript
 * import { learn } from 'muscle-memory';
 *
 * // Cron job, every hour
 * await learn({ db: './muscle-memory.db' });
 * ```
 */
export async function learn(options: LearnOptions = {}): Promise<{
  templatesCreated: number;
  templatesUpdated: number;
}> {
  const config: MithrilConfig = {
    ...DEFAULT_CONFIG,
    dbPath: options.db ?? DEFAULT_CONFIG.dbPath,
    minTracesForTemplate: options.minTraces ?? DEFAULT_CONFIG.minTracesForTemplate,
    confidenceThreshold: options.confidence ?? DEFAULT_CONFIG.confidenceThreshold,
  };

  const store = new SqliteStore(options.db ?? './muscle-memory.db');
  const { runLearningPipeline } = await import('./learner/pipeline.js');
  return runLearningPipeline(store, config, {});
}
