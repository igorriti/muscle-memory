import { generateText, embed } from 'ai';
import { v4 as uuid } from 'uuid';
import { Store, MithrilConfig, Template, Trace, ExecutionGraph, GraphNode, GraphEdge, ArgField } from '../types.js';

function cosine(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function runLearningPipeline(
  store: Store,
  config: MithrilConfig,
  tools: Record<string, any>,
): Promise<{ templatesCreated: number; templatesUpdated: number }> {
  const unclassified = store.getUnclassifiedTraces();
  if (unclassified.length === 0) return { templatesCreated: 0, templatesUpdated: 0 };

  // Cluster by tool sequence: traces that called the same tools in the same order
  // belong together. This is far more accurate than embedding similarity for clustering.
  const clusters = clusterByToolSequence(unclassified);

  let created = 0;
  let updated = 0;

  for (const cluster of clusters) {
    if (cluster.length < config.minTracesForTemplate) continue;

    const centroid = computeCentroid(cluster.map(t => t.userMessageEmbedding!));
    const existing = store.getAllActiveTemplates();
    const existingMatch = existing.find(t => cosine(centroid, t.embedding) > 0.85);

    if (existingMatch) {
      updated++;
    } else {
      const graph = extractGraphFromTraces(cluster);
      const argSchema = inferArgSchema(cluster);
      const name = await generateName(cluster, config);

      const template: Template = {
        templateId: uuid(),
        name,
        embedding: centroid,
        argSchema,
        graph,
        confidence: cluster.filter(t => t.success).length / cluster.length,
        totalExecutions: cluster.length,
        successfulExecutions: cluster.filter(t => t.success).length,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        ttlDays: config.ttlDays,
        status: 'active',
      };

      store.saveTemplate(template);
      created++;
    }

    store.markTracesClassified(cluster.map(t => t.traceId));
  }

  return { templatesCreated: created, templatesUpdated: updated };
}

/**
 * Cluster traces by their tool-call sequence.
 * "Cancel my order" and "hey cancel asap" both call [cancel_order] → same cluster.
 * "Track my order" calls [track_order] → different cluster.
 * This is deterministic and perfectly accurate — no embedding guesswork.
 */
function clusterByToolSequence(traces: Trace[]): Trace[][] {
  const groups = new Map<string, Trace[]>();
  for (const t of traces) {
    const key = t.steps.map(s => s.toolName).join(' → ') || '(no tools)';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  return [...groups.values()];
}

function clusterTraces(traces: Trace[], threshold: number): Trace[][] {
  const assigned = new Set<number>();
  const clusters: Trace[][] = [];

  for (let i = 0; i < traces.length; i++) {
    if (assigned.has(i)) continue;
    const cluster: Trace[] = [traces[i]];
    assigned.add(i);

    for (let j = i + 1; j < traces.length; j++) {
      if (assigned.has(j)) continue;
      if (!traces[i].userMessageEmbedding || !traces[j].userMessageEmbedding) continue;

      const sim = cosine(traces[i].userMessageEmbedding!, traces[j].userMessageEmbedding!);
      if (sim >= threshold) {
        cluster.push(traces[j]);
        assigned.add(j);
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

function computeCentroid(embeddings: number[][]): number[] {
  const dim = embeddings[0].length;
  const centroid = new Array(dim).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) centroid[i] += emb[i];
  }
  for (let i = 0; i < dim; i++) centroid[i] /= embeddings.length;
  return centroid;
}

/**
 * Build the execution graph directly from recorded traces.
 * No LLM needed — the traces already contain exact tool names, args, and order.
 *
 * Algorithm:
 * 1. Find the most common tool sequence across traces
 * 2. Build nodes from that sequence with arg templates
 * 3. Build edges connecting sequential nodes
 */
function extractGraphFromTraces(traces: Trace[]): ExecutionGraph {
  // Find the most common tool-call sequence
  const sequenceCounts = new Map<string, { count: number; steps: Trace['steps'] }>();
  for (const t of traces) {
    const key = t.steps.map(s => s.toolName).join(' → ');
    const existing = sequenceCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      sequenceCounts.set(key, { count: 1, steps: t.steps });
    }
  }

  // Pick the most frequent sequence
  let bestSteps: Trace['steps'] = traces[0]?.steps ?? [];
  let bestCount = 0;
  for (const [, entry] of sequenceCounts) {
    if (entry.count > bestCount) {
      bestCount = entry.count;
      bestSteps = entry.steps;
    }
  }

  // Build nodes from the steps
  const nodes: GraphNode[] = bestSteps.map((step, i) => {
    // Build argsTemplate: values that vary across traces become {field_name}
    const argsTemplate: Record<string, string> = {};
    const allInputsAtStep = traces
      .filter(t => t.steps[i]?.toolName === step.toolName)
      .map(t => t.steps[i]?.toolInput ?? {});

    for (const [key, value] of Object.entries(step.toolInput ?? {})) {
      const valuesAtKey = allInputsAtStep.map(inp => inp[key]).filter(v => v != null);
      const unique = new Set(valuesAtKey.map(String));
      if (unique.size > 1) {
        // Value varies → make it a variable
        argsTemplate[key] = `{${key}}`;
      } else {
        // Value is constant → keep it static
        argsTemplate[key] = String(value);
      }
    }

    return { id: `n${i + 1}`, tool: step.toolName, argsTemplate };
  });

  // Build edges connecting sequential nodes
  const edges: GraphEdge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      from: nodes[i].id,
      to: nodes[i + 1].id,
      condition: null,
      weight: bestCount / traces.length,
      type: 'normal' as const,
    });
  }

  return {
    nodes,
    edges,
    rootNodeId: nodes[0]?.id ?? 'n1',
  };
}

function inferArgSchema(traces: Trace[]): ArgField[] {
  const firstStepArgs = traces.map(t => t.steps[0]?.toolInput ?? {});
  const fields: ArgField[] = [];
  const seenKeys = new Set<string>();

  for (const args of firstStepArgs) {
    for (const [key, value] of Object.entries(args)) {
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const values = firstStepArgs.map(a => a[key]).filter(v => v != null);
      const unique = new Set(values.map(String));

      if (unique.size > 1) {
        fields.push({
          name: key,
          type: typeof value === 'number' ? 'number' : 'string',
          required: values.length === traces.length,
          description: `The ${key} for this operation`,
          examples: [...unique].slice(0, 3),
        });
      }
    }
  }
  return fields;
}

async function generateName(traces: Trace[], config: MithrilConfig): Promise<string> {
  if (!config.extractorModel) {
    // fallback: generate name from first trace's tool calls
    const tools = traces[0].steps.map(s => s.toolName);
    return tools.slice(0, 2).join('_');
  }

  const messages = traces.slice(0, 5).map(t => t.userMessage);
  const { text } = await generateText({
    model: config.extractorModel,
    prompt: `Given these user messages that all represent the same type of task, generate a short snake_case name (2-3 words max) that describes the task type. Messages:\n${messages.join('\n')}\n\nName:`,
  });
  return text.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}
