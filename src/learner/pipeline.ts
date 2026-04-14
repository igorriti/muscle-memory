import { generateText, embed } from 'ai';
import { v4 as uuid } from 'uuid';
import { Store, MithrilConfig, Template, Trace, ExecutionGraph, ArgField } from '../types.js';

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

  const clusters = clusterTraces(unclassified, 0.80);

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
      const graph = await extractGraph(cluster, config);
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

async function extractGraph(traces: Trace[], config: MithrilConfig): Promise<ExecutionGraph> {
  if (!config.plannerModel) throw new Error('plannerModel required for learning');

  const traceSummaries = traces.map(t => ({
    message: t.userMessage,
    steps: t.steps.map(s => ({
      tool: s.toolName,
      input: s.toolInput,
      output: s.toolOutput,
      success: s.success,
    })),
  }));

  const { text } = await generateText({
    model: config.plannerModel,
    system: `You are a workflow analyst. Given execution traces of the same task type, extract the common execution graph as a DAG. Return ONLY valid JSON matching this schema:
{
  "nodes": [{ "id": "n1", "tool": "tool_name", "argsTemplate": { "field": "{variable_or_static}" } }],
  "edges": [{ "from": "n1", "to": "n2", "condition": "n1.output.field == 'value'" | null, "weight": 0.88, "type": "normal" | "fallback" }],
  "rootNodeId": "n1"
}
Rules:
- Concrete values that change between traces become {variable_name} in argsTemplate
- Values that come from a previous node's output use {nodeId.output.field}
- Static values stay as-is
- weight = fraction of traces that took this edge
- Mark edges that only activate on failure as "fallback"`,
    prompt: JSON.stringify(traceSummaries, null, 2),
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to extract graph from traces');
  return JSON.parse(jsonMatch[0]) as ExecutionGraph;
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
    temperature: 0,
  });
  return text.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}
