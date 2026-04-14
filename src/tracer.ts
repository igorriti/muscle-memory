import { embed } from 'ai';
import { Trace, MithrilConfig, Store } from './types.js';

export class Tracer {
  constructor(
    private store: Store,
    private config: MithrilConfig,
  ) {}

  async save(trace: Trace): Promise<void> {
    this.store.saveTrace(trace);
    this.generateEmbedding(trace.traceId, trace.userMessage).catch(err => {
      console.error(`[mithril] Failed to generate embedding for ${trace.traceId}:`, err);
    });
  }

  private async generateEmbedding(traceId: string, text: string): Promise<void> {
    const { embedding } = await embed({
      model: this.config.embeddingModel,
      value: text,
    });
    this.store.updateTraceEmbedding(traceId, embedding);
  }
}
