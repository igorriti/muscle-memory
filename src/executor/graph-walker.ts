import { v4 as uuid } from 'uuid';
import { ExecutionGraph, Trace, TraceStep, ToolRegistry } from '../types.js';
import { evaluateCondition } from './condition-eval.js';

export async function walkGraph(
  graph: ExecutionGraph,
  userArgs: Record<string, any>,
  tools: ToolRegistry,
  userMessage: string,
  templateId: string,
): Promise<{ text: string; trace: Trace }> {
  const startTime = Date.now();
  const context: Record<string, { output: any }> = {};
  const steps: TraceStep[] = [];
  let stepId = 0;
  let currentNodeId: string | null = graph.rootNodeId;

  while (currentNodeId) {
    const node = graph.nodes.find(n => n.id === currentNodeId);
    if (!node) break;

    const resolvedArgs: Record<string, any> = {};
    for (const [key, valueTemplate] of Object.entries(node.argsTemplate)) {
      resolvedArgs[key] = resolveArg(valueTemplate, userArgs, context);
    }

    const toolDef = tools[node.tool];
    if (!toolDef) {
      // Template references a tool the LLM hallucinated — skip this node
      context[node.id] = { output: { error: `Unknown tool: ${node.tool}` } };
      steps.push({ stepId: stepId++, toolName: node.tool, toolInput: resolvedArgs, toolOutput: { error: `Unknown tool: ${node.tool}` }, latencyMs: 0, success: false, dependsOn: stepId > 1 ? stepId - 2 : null, error: `Unknown tool: ${node.tool}` });
      currentNodeId = null;
      continue;
    }

    const toolStart = Date.now();
    let toolOutput: any;
    let success = true;
    let error: string | undefined;

    try {
      toolOutput = await toolDef.execute(resolvedArgs);
    } catch (err: any) {
      toolOutput = { error: err.message };
      success = false;
      error = err.message;
    }

    context[node.id] = { output: toolOutput };

    steps.push({
      stepId: stepId++,
      toolName: node.tool,
      toolInput: resolvedArgs,
      toolOutput,
      latencyMs: Date.now() - toolStart,
      success,
      dependsOn: stepId > 1 ? stepId - 2 : null,
      error,
    });

    const outEdges = graph.edges
      .filter(e => e.from === currentNodeId)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'normal' ? -1 : 1;
        return b.weight - a.weight;
      });

    let nextNodeId: string | null = null;

    if (success) {
      for (const edge of outEdges.filter(e => e.type === 'normal')) {
        if (evaluateCondition(edge.condition, context)) {
          nextNodeId = edge.to;
          break;
        }
      }
    } else {
      const fallback = outEdges.find(e => e.type === 'fallback');
      if (fallback) {
        nextNodeId = fallback.to;
      }
    }

    currentNodeId = nextNodeId;
  }

  const allSuccess = steps.every(s => s.success);
  const finalResponse = JSON.stringify(steps.map(s => ({ tool: s.toolName, result: s.toolOutput })));
  const trace: Trace = {
    traceId: uuid(),
    timestamp: new Date().toISOString(),
    userMessage,
    userMessageEmbedding: null,
    steps,
    finalResponse,
    totalTokens: 0,
    totalCostUsd: 0.001,
    totalLatencyMs: Date.now() - startTime,
    success: allSuccess,
    phase: 3,
    templateId,
    routingReason: 'Muscle memory -- template match with high confidence',
  };

  return { text: trace.finalResponse, trace };
}

function resolveArg(
  template: string,
  userArgs: Record<string, any>,
  context: Record<string, { output: any }>,
): any {
  if (typeof template !== 'string') return template;
  if (!template.startsWith('{')) return template;

  const path = template.slice(1, -1);

  if (!path.includes('.')) {
    return userArgs[path] ?? null;
  }

  const parts = path.split('.');
  const nodeId = parts[0];
  const rest = parts.slice(1).join('.');
  const nodeCtx = context[nodeId];
  if (!nodeCtx) return null;
  return rest.split('.').reduce((acc: any, key) => acc?.[key], nodeCtx);
}
