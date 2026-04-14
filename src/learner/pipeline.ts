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

  // Cluster by exact tool sequence — only traces that called the exact same
  // tools in the same order belong together. This prevents "cancel order"
  // and "track order" from merging just because both start with get_order.
  const clusters = clusterByToolSequence(unclassified);

  let created = 0;
  let updated = 0;

  for (const cluster of clusters) {
    if (cluster.length < config.minTracesForTemplate) continue;

    const withEmbeddings = cluster.filter(t => t.userMessageEmbedding != null);
    if (withEmbeddings.length === 0) continue;

    const centroid = computeCentroid(withEmbeddings.map(t => t.userMessageEmbedding!));
    const existing = store.getAllActiveTemplates();
    const existingMatch = existing.find(t => cosine(centroid, t.embedding) > 0.90);

    if (existingMatch) {
      updated++;
    } else {
      const graph = buildBranchingGraph(cluster);
      if (graph.nodes.length === 0) continue;

      const argSchema = inferArgSchema(cluster);
      const name = generateNameFromTools(cluster);

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

// ════════════════════════════════════════════
//  CLUSTERING
// ════════════════════════════════════════════

/**
 * Cluster by exact tool-call sequence.
 * Only traces calling the exact same tools in the same order cluster together.
 * This prevents "cancel order" [cancel_order] from merging with
 * "track order" [track_order] even though both mention "order".
 */
function clusterByToolSequence(traces: Trace[]): Trace[][] {
  const groups = new Map<string, Trace[]>();
  for (const t of traces) {
    const key = t.steps.map(s => s.toolName).join('→') || '(none)';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  return [...groups.values()];
}

function computeCentroid(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];
  const dim = embeddings[0].length;
  const centroid = new Array(dim).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) centroid[i] += emb[i];
  }
  for (let i = 0; i < dim; i++) centroid[i] /= embeddings.length;
  return centroid;
}

// ════════════════════════════════════════════
//  BRANCHING GRAPH EXTRACTION
// ════════════════════════════════════════════

/**
 * Build a branching DAG from traces. Handles:
 * 1. Multiple paths (80% do A→B, 20% do A→B→C)
 * 2. Weighted edges based on frequency
 * 3. Conditions extracted from output values when paths diverge
 * 4. Fallback edges when a tool fails and a different tool is called
 *
 * All deterministic — no LLM needed.
 */
function buildBranchingGraph(traces: Trace[]): ExecutionGraph {
  // Step 1: Collect all unique tool positions
  // Each (position, toolName) pair is a node
  const nodeMap = new Map<string, { tool: string; position: number; count: number }>();
  const maxSteps = Math.max(...traces.map(t => t.steps.length), 0);

  for (const t of traces) {
    for (let i = 0; i < t.steps.length; i++) {
      const step = t.steps[i];
      const key = `${i}:${step.toolName}`;
      if (!nodeMap.has(key)) {
        nodeMap.set(key, { tool: step.toolName, position: i, count: 0 });
      }
      nodeMap.get(key)!.count++;
    }
  }

  // Create nodes with IDs
  const nodes: GraphNode[] = [];
  const nodeIds = new Map<string, string>(); // key → nodeId

  for (const [key, info] of nodeMap) {
    const id = `n${nodes.length + 1}`;
    nodeIds.set(key, id);

    // Build argsTemplate from traces at this position
    const argsTemplate: Record<string, string> = {};
    const stepsAtPos = traces
      .filter(t => t.steps[info.position]?.toolName === info.tool)
      .map(t => t.steps[info.position]);

    if (stepsAtPos.length > 0) {
      const sampleInput = stepsAtPos[0].toolInput ?? {};
      for (const [k, v] of Object.entries(sampleInput)) {
        const values = stepsAtPos.map(s => s.toolInput?.[k]).filter(x => x != null);
        const unique = new Set(values.map(String));
        argsTemplate[k] = unique.size > 1 ? `{${k}}` : String(v);
      }
    }

    nodes.push({ id, tool: info.tool, argsTemplate });
  }

  // Step 2: Build edges by counting transitions
  const edgeCounts = new Map<string, { count: number; total: number; failCount: number; conditions: Map<string, number> }>();

  for (const t of traces) {
    for (let i = 0; i < t.steps.length - 1; i++) {
      const fromKey = `${i}:${t.steps[i].toolName}`;
      const toKey = `${i + 1}:${t.steps[i + 1].toolName}`;
      const fromId = nodeIds.get(fromKey);
      const toId = nodeIds.get(toKey);
      if (!fromId || !toId) continue;

      const edgeKey = `${fromId}→${toId}`;
      if (!edgeCounts.has(edgeKey)) {
        edgeCounts.set(edgeKey, { count: 0, total: 0, failCount: 0, conditions: new Map() });
      }
      const ec = edgeCounts.get(edgeKey)!;
      ec.count++;

      // Track if this transition happened after a failure
      if (!t.steps[i].success) ec.failCount++;

      // Track output values for condition extraction
      const output = t.steps[i].toolOutput;
      if (output && typeof output === 'object') {
        for (const [k, v] of Object.entries(output)) {
          if (typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number') {
            const condKey = `${fromId}.output.${k} == ${JSON.stringify(v)}`;
            ec.conditions.set(condKey, (ec.conditions.get(condKey) ?? 0) + 1);
          }
        }
      }
    }
  }

  // Count how many traces pass through each node (for weight calculation)
  for (const t of traces) {
    for (let i = 0; i < t.steps.length - 1; i++) {
      const fromKey = `${i}:${t.steps[i].toolName}`;
      const toKey = `${i + 1}:${t.steps[i + 1].toolName}`;
      const fromId = nodeIds.get(fromKey);
      const toId = nodeIds.get(toKey);
      if (!fromId || !toId) continue;
      // Count total outgoing from this node
      for (const [ek, ev] of edgeCounts) {
        if (ek.startsWith(fromId + '→')) {
          ev.total = traces.filter(tr => {
            const idx = tr.steps.findIndex((s, j) => `${j}:${s.toolName}` === fromKey);
            return idx >= 0;
          }).length;
        }
      }
    }
  }

  // Step 3: Create edges with weights and conditions
  const edges: GraphEdge[] = [];
  for (const [edgeKey, ec] of edgeCounts) {
    const [fromId, toId] = edgeKey.split('→');
    const weight = ec.total > 0 ? ec.count / ec.total : 1;
    const isFallback = ec.failCount > ec.count / 2;

    // Extract condition: find the most common output value for this edge
    // that distinguishes it from other edges from the same source
    let condition: string | null = null;
    const otherEdgesFromSame = [...edgeCounts.entries()]
      .filter(([k]) => k.startsWith(fromId + '→') && k !== edgeKey);

    if (otherEdgesFromSame.length > 0 && ec.conditions.size > 0) {
      // Find condition that best differentiates this edge
      let bestCond = '';
      let bestScore = 0;
      for (const [cond, count] of ec.conditions) {
        const score = count / ec.count; // what fraction of this edge's traces have this condition
        if (score > bestScore && score > 0.7) {
          bestScore = score;
          bestCond = cond;
        }
      }
      if (bestCond) condition = bestCond;
    }

    edges.push({
      from: fromId,
      to: toId,
      condition,
      weight,
      type: isFallback ? 'fallback' : 'normal',
    });
  }

  // Find root node (position 0)
  const rootNode = nodes.find(n => {
    const entry = [...nodeMap.entries()].find(([, info]) => info.position === 0);
    return entry && nodeIds.get(entry[0]) === n.id;
  });

  return {
    nodes,
    edges,
    rootNodeId: rootNode?.id ?? nodes[0]?.id ?? 'n1',
  };
}

// ════════════════════════════════════════════
//  ARG SCHEMA INFERENCE
// ════════════════════════════════════════════

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

// ════════════════════════════════════════════
//  NAME GENERATION (deterministic, no LLM)
// ════════════════════════════════════════════

/**
 * Generate template name from the tools called.
 * No LLM needed — the tool names are descriptive enough.
 */
function generateNameFromTools(traces: Trace[]): string {
  // Get the most common first tool
  const toolCounts = new Map<string, number>();
  for (const t of traces) {
    const tools = t.steps.map(s => s.toolName).join('_');
    toolCounts.set(tools, (toolCounts.get(tools) ?? 0) + 1);
  }

  let bestTools = '';
  let bestCount = 0;
  for (const [tools, count] of toolCounts) {
    if (count > bestCount) { bestCount = count; bestTools = tools; }
  }

  // Use first 2 tool names as the template name
  const parts = bestTools.split('_').slice(0, 3);
  return parts.join('_') || 'unknown';
}
