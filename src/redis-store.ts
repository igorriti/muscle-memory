import { Trace, Template, Store } from './types.js';

export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<any>;
  del(key: string): Promise<any>;
  keys(pattern: string): Promise<string[]>;
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<any>;
  hgetall(key: string): Promise<Record<string, string>>;
  lpush(key: string, ...values: string[]): Promise<any>;
}

export interface RedisStoreConfig {
  client: RedisClient;
  prefix?: string;  // key prefix, default: 'mm'
}

export class RedisStore implements Store {
  private client: RedisClient;
  private prefix: string;

  // In-memory cache for sync reads
  private traces: Map<string, Trace> = new Map();
  private templates: Map<string, Template> = new Map();
  private unclassified: Set<string> = new Set();

  private constructor(config: RedisStoreConfig) {
    this.client = config.client;
    this.prefix = config.prefix ?? 'mm';
  }

  static async create(config: RedisStoreConfig): Promise<RedisStore> {
    const store = new RedisStore(config);
    await store.loadFromRedis();
    return store;
  }

  private async loadFromRedis(): Promise<void> {
    // Load templates
    const templateKeys = await this.client.keys(`${this.prefix}:templates:*`);
    for (const key of templateKeys) {
      const data = await this.client.get(key);
      if (data) {
        const template = JSON.parse(data) as Template;
        this.templates.set(template.templateId, template);
      }
    }

    // Load unclassified trace IDs
    const unclassifiedData = await this.client.get(`${this.prefix}:unclassified`);
    if (unclassifiedData) {
      const ids = JSON.parse(unclassifiedData) as string[];
      for (const id of ids) this.unclassified.add(id);
    }

    // Load traces that are unclassified (for learning)
    for (const traceId of this.unclassified) {
      const data = await this.client.get(`${this.prefix}:traces:${traceId}`);
      if (data) {
        this.traces.set(traceId, JSON.parse(data));
      }
    }
  }

  // Persist to Redis in background (fire-and-forget)
  private persist(fn: () => Promise<void>): void {
    fn().catch(err => console.error('[muscle-memory] Redis persist error:', err));
  }

  saveTrace(trace: Trace): void {
    this.traces.set(trace.traceId, trace);
    if (trace.success && !trace.templateId) {
      this.unclassified.add(trace.traceId);
    }
    this.persist(async () => {
      await this.client.set(
        `${this.prefix}:traces:${trace.traceId}`,
        JSON.stringify(trace),
      );
      await this.client.set(
        `${this.prefix}:unclassified`,
        JSON.stringify([...this.unclassified]),
      );
    });
  }

  getUnclassifiedTraces(): Trace[] {
    return [...this.unclassified]
      .map(id => this.traces.get(id))
      .filter((t): t is Trace => t != null && t.success && t.userMessageEmbedding != null);
  }

  getTracesByTemplateId(templateId: string, limit = 20): Trace[] {
    return [...this.traces.values()]
      .filter(t => t.templateId === templateId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }

  markTracesClassified(traceIds: string[]): void {
    for (const id of traceIds) {
      this.unclassified.delete(id);
    }
    this.persist(async () => {
      await this.client.set(
        `${this.prefix}:unclassified`,
        JSON.stringify([...this.unclassified]),
      );
    });
  }

  updateTraceEmbedding(traceId: string, embedding: number[]): void {
    const trace = this.traces.get(traceId);
    if (trace) {
      trace.userMessageEmbedding = embedding;
      this.persist(async () => {
        await this.client.set(
          `${this.prefix}:traces:${traceId}`,
          JSON.stringify(trace),
        );
      });
    }
  }

  saveTemplate(template: Template): void {
    this.templates.set(template.templateId, template);
    this.persist(async () => {
      await this.client.set(
        `${this.prefix}:templates:${template.templateId}`,
        JSON.stringify(template),
      );
    });
  }

  getAllActiveTemplates(): Template[] {
    return [...this.templates.values()].filter(t => t.status === 'active');
  }

  getTemplate(templateId: string): Template | null {
    return this.templates.get(templateId) ?? null;
  }

  updateTemplateAfterExecution(templateId: string, success: boolean): void {
    const t = this.templates.get(templateId);
    if (!t) return;
    t.totalExecutions++;
    if (success) t.successfulExecutions++;
    t.confidence = t.successfulExecutions / t.totalExecutions;
    t.lastUsedAt = new Date().toISOString();
    this.persist(async () => {
      await this.client.set(
        `${this.prefix}:templates:${templateId}`,
        JSON.stringify(t),
      );
    });
  }

  degradeTemplate(templateId: string): void {
    const t = this.templates.get(templateId);
    if (t) {
      t.status = 'degraded';
      this.persist(async () => {
        await this.client.set(
          `${this.prefix}:templates:${templateId}`,
          JSON.stringify(t),
        );
      });
    }
  }

  logRouting(entry: {
    userMessage: string;
    phase: number;
    reason: string;
    templateId?: string;
    similarity?: number;
    confidence?: number;
    latencyMs?: number;
    costUsd?: number;
    success?: boolean;
  }): void {
    this.persist(async () => {
      await this.client.lpush(
        `${this.prefix}:routing-log`,
        JSON.stringify({ ...entry, timestamp: new Date().toISOString() }),
      );
    });
  }

  getMetrics(): any {
    const traces = [...this.traces.values()];
    const total = traces.length;
    const byPhase = [1, 2, 3].map(phase => {
      const phaseTraces = traces.filter(t => t.phase === phase);
      return {
        phase,
        c: phaseTraces.length,
        avgLat: phaseTraces.length ? phaseTraces.reduce((s, t) => s + t.totalLatencyMs, 0) / phaseTraces.length : 0,
        avgCost: phaseTraces.length ? phaseTraces.reduce((s, t) => s + t.totalCostUsd, 0) / phaseTraces.length : 0,
      };
    }).filter(p => p.c > 0);
    const successRate = total ? traces.filter(t => t.success).length / total : 0;
    return { total, byPhase, successRate };
  }
}
