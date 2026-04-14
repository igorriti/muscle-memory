import { ToolRegistry, MithrilConfig, DEFAULT_CONFIG, RoutingDecision, Store } from './types.js';
import { SqliteStore } from './store.js';
import { Tracer } from './tracer.js';
import { runAgent } from './agent.js';
import { IntentMatcher } from './executor/intent-matcher.js';
import { ArgExtractor } from './executor/arg-extractor.js';
import { walkGraph } from './executor/graph-walker.js';

export class Mithril {
  private store: Store;
  private tracer: Tracer;
  private matcher: IntentMatcher;
  private extractor: ArgExtractor;
  private tools: ToolRegistry;
  private config: MithrilConfig;

  constructor(tools: ToolRegistry, config: Partial<MithrilConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tools = tools;
    this.store = new SqliteStore(this.config.dbPath);
    this.tracer = new Tracer(this.store, this.config);
    this.matcher = new IntentMatcher(this.store, this.config);
    this.extractor = new ArgExtractor(this.config);
    this.matcher.reload();
  }

  async chat(userMessage: string): Promise<{
    response: string;
    phase: number;
    traceId: string;
    latencyMs: number;
    costUsd: number;
  }> {
    const match = await this.matcher.match(userMessage);

    let decision: RoutingDecision;

    if (!match || match.similarity < this.config.ambiguousZoneLower) {
      decision = { phase: 1, reason: 'No template match' };
    } else {
      const template = this.store.getTemplate(match.templateId);

      if (!template || template.status === 'degraded') {
        decision = { phase: 1, reason: 'Template degraded or not found' };
      } else if (
        template.confidence >= this.config.confidenceThreshold &&
        match.similarity >= this.config.similarityThreshold
      ) {
        const extraction = await this.extractor.extract(userMessage, template.argSchema);

        if (extraction.allRequiredPresent) {
          decision = {
            phase: 3,
            reason: `Template match (sim=${match.similarity.toFixed(3)}, conf=${template.confidence.toFixed(3)})`,
            templateId: template.templateId,
            similarity: match.similarity,
            confidence: template.confidence,
          };
        } else {
          decision = {
            phase: 1,
            reason: `Missing required args: ${extraction.missingFields.join(', ')}`,
          };
        }
      } else {
        decision = {
          phase: 1,
          reason: `Below thresholds (sim=${match.similarity.toFixed(3)}, conf=${template?.confidence.toFixed(3)})`,
        };
      }
    }

    let response: string;
    let trace: any;

    if (decision.phase === 3 && decision.templateId) {
      const template = this.store.getTemplate(decision.templateId)!;
      const extraction = await this.extractor.extract(userMessage, template.argSchema);
      const result = await walkGraph(
        template.graph,
        extraction.args,
        this.tools,
        userMessage,
        template.templateId,
      );
      response = result.text;
      trace = result.trace;

      this.store.updateTemplateAfterExecution(template.templateId, trace.success);
      this.checkDegradation(template.templateId);
    } else {
      const result = await runAgent(userMessage, this.tools, this.config);
      response = result.text;
      trace = result.trace;
    }

    trace.routingReason = decision.reason;
    await this.tracer.save(trace);

    this.store.logRouting({
      userMessage,
      phase: decision.phase,
      reason: decision.reason,
      templateId: decision.templateId,
      similarity: decision.similarity,
      confidence: decision.confidence,
      latencyMs: trace.totalLatencyMs,
      costUsd: trace.totalCostUsd,
      success: trace.success,
    });

    return {
      response,
      phase: decision.phase,
      traceId: trace.traceId,
      latencyMs: trace.totalLatencyMs,
      costUsd: trace.totalCostUsd,
    };
  }

  private checkDegradation(templateId: string): void {
    const recentTraces = this.store.getTracesByTemplateId(templateId, 20);
    const recentSuccessRate = recentTraces.filter(t => t.success).length / recentTraces.length;

    if (recentSuccessRate < this.config.degradeSuccessRate) {
      this.store.degradeTemplate(templateId);
      this.matcher.reload();
    }

    const lastN = recentTraces.slice(0, this.config.failuresToDegrade);
    if (lastN.length >= this.config.failuresToDegrade && lastN.every(t => !t.success)) {
      this.store.degradeTemplate(templateId);
      this.matcher.reload();
    }
  }

  async learn(): Promise<{ templatesCreated: number; templatesUpdated: number }> {
    const { runLearningPipeline } = await import('./learner/pipeline.js');
    const result = await runLearningPipeline(this.store, this.config, this.tools);
    this.matcher.reload();
    return result;
  }

  getMetrics() {
    return this.store.getMetrics();
  }

  invalidateTemplate(templateId: string): void {
    this.store.degradeTemplate(templateId);
    this.matcher.reload();
  }
}
