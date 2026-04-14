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
  // Map from keyword → templateId. Multiple keywords per template.
  private keywords: Map<string, string> = new Map();

  constructor(
    private store: Store,
    private config: MithrilConfig,
  ) {}

  reload(): void {
    this.templates = this.store.getAllActiveTemplates();
    this.keywords.clear();

    for (const t of this.templates) {
      // Add template name as keyword
      const nameKeyword = t.name.replace(/_/g, ' ').toLowerCase();
      this.keywords.set(nameKeyword, t.templateId);

      // Add full tool names as keywords (multi-word only, to avoid
      // single common words like "order" matching everything)
      // "cancel_order" → "cancel order" (2+ words, specific)
      // "get_payment_status" → "payment status" (strip get/set prefix, still 2+ words)
      for (const node of t.graph.nodes) {
        const toolWords = node.tool.replace(/_/g, ' ').toLowerCase();
        // Only add as keyword if 2+ words (avoids "order", "refund" etc.)
        if (toolWords.split(' ').length >= 2) {
          this.keywords.set(toolWords, t.templateId);
        }

        // Strip common prefixes and add if still 2+ words
        const stripped = toolWords
          .replace(/^(get|set|check|create|list|update|delete|add|remove|process|send|start) /, '');
        if (stripped !== toolWords && stripped.split(' ').length >= 2) {
          this.keywords.set(stripped, t.templateId);
        }
      }
    }
  }

  async match(userMessage: string): Promise<MatchResult | null> {
    const normalized = userMessage.toLowerCase().trim();

    // Keyword matching: check if query contains any tool-derived keyword
    // Sort by longest keyword first to prefer more specific matches
    const sortedKeywords = [...this.keywords.entries()]
      .sort((a, b) => b[0].length - a[0].length);

    for (const [keyword, templateId] of sortedKeywords) {
      if (normalized.includes(keyword)) {
        return { templateId, similarity: 1.0, matchType: 'keyword' };
      }
    }

    // Embedding matching: semantic similarity
    if (this.templates.length === 0) return null;
    if (!this.config.embeddingModel) return null;

    const { embedding } = await embed({
      model: this.config.embeddingModel,
      value: userMessage,
    });

    // Collect all candidates above the ambiguous zone
    const candidates: { templateId: string; similarity: number }[] = [];

    for (const template of this.templates) {
      if (!template.embedding || template.embedding.length === 0) continue;
      const sim = cosine(embedding, template.embedding);
      if (sim >= this.config.ambiguousZoneLower) {
        candidates.push({ templateId: template.templateId, similarity: sim });
      }
    }

    if (candidates.length === 0) return null;

    // If multiple candidates are close (within 0.05 of best),
    // prefer the one whose tool names appear in the query
    candidates.sort((a, b) => b.similarity - a.similarity);
    const best = candidates[0];
    const closeOnes = candidates.filter(c => c.similarity >= best.similarity - 0.05);

    if (closeOnes.length > 1) {
      // Disambiguate by checking tool names in query
      for (const candidate of closeOnes) {
        const tpl = this.templates.find(t => t.templateId === candidate.templateId);
        if (!tpl) continue;
        const toolWords = tpl.graph.nodes.map(n =>
          n.tool.replace(/_/g, ' ').toLowerCase()
        );
        // Does the query mention any of this template's specific tools?
        if (toolWords.some(tw => normalized.includes(tw))) {
          return { templateId: candidate.templateId, similarity: candidate.similarity, matchType: 'embedding' as const };
        }
      }
    }

    return { templateId: best.templateId, similarity: best.similarity, matchType: 'embedding' as const };
  }
}
