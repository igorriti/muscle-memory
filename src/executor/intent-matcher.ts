import { embed } from 'ai';
import { Template, MatchResult, MithrilConfig, Store } from '../types.js';

function cosine(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class IntentMatcher {
  private templates: Template[] = [];
  private keywords: Map<string, string> = new Map();

  constructor(
    private store: Store,
    private config: MithrilConfig,
  ) {}

  reload(): void {
    this.templates = this.store.getAllActiveTemplates();
    this.keywords.clear();
    for (const t of this.templates) {
      const keyword = t.name.replace(/_/g, ' ').toLowerCase();
      this.keywords.set(keyword, t.templateId);
    }
  }

  async match(userMessage: string): Promise<MatchResult | null> {
    const normalized = userMessage.toLowerCase().trim();
    for (const [keyword, templateId] of this.keywords) {
      if (normalized.includes(keyword)) {
        return { templateId, similarity: 1.0, matchType: 'keyword' };
      }
    }

    if (this.templates.length === 0) return null;

    const { embedding } = await embed({
      model: this.config.embeddingModel,
      value: userMessage,
    });

    let bestMatch: MatchResult | null = null;
    let bestSimilarity = -1;

    for (const template of this.templates) {
      const sim = cosine(embedding, template.embedding);
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestMatch = {
          templateId: template.templateId,
          similarity: sim,
          matchType: 'embedding',
        };
      }
    }

    if (!bestMatch || bestMatch.similarity < this.config.ambiguousZoneLower) {
      return null;
    }

    return bestMatch;
  }
}
