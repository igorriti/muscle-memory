import { generateText, tool } from 'ai';
import { v4 as uuid } from 'uuid';
import { Trace, TraceStep, ToolRegistry, MithrilConfig } from './types.js';

export async function runAgent(
  userMessage: string,
  tools: ToolRegistry,
  config: MithrilConfig,
): Promise<{ text: string; trace: Trace }> {
  const startTime = Date.now();

  // Convert our ToolRegistry to AI SDK tool format
  const aiTools: Record<string, any> = {};
  for (const [name, def] of Object.entries(tools)) {
    aiTools[name] = tool({
      description: def.description,
      inputSchema: def.inputSchema as any,
      execute: def.execute,
    } as any);
  }

  const result = await generateText({
    model: config.plannerModel as any,
    system: config.systemPrompt,
    prompt: userMessage,
    tools: aiTools,
    maxSteps: 10,
  } as any);

  // Extract trace from AI SDK steps
  const steps: TraceStep[] = [];
  let stepId = 0;

  for (const step of (result as any).steps ?? []) {
    for (const tc of (step.toolCalls ?? [])) {
      const toolResult = (step.toolResults ?? []).find(
        (r: any) => r.toolCallId === tc.toolCallId,
      );
      steps.push({
        stepId: stepId++,
        toolName: tc.toolName,
        toolInput: tc.input ?? tc.args ?? {},
        toolOutput: toolResult?.output ?? toolResult?.result ?? {},
        latencyMs: 0,
        success: toolResult ? !toolResult.isError : true,
        dependsOn: stepId > 1 ? stepId - 2 : null,
      });
    }
  }

  const usage = (result as any).usage;

  const trace: Trace = {
    traceId: uuid(),
    timestamp: new Date().toISOString(),
    userMessage,
    userMessageEmbedding: null,
    steps,
    finalResponse: result.text,
    totalTokens: usage?.totalTokens ?? 0,
    totalCostUsd: estimateCost(usage, config.plannerModel),
    totalLatencyMs: Date.now() - startTime,
    success: true,
    phase: 1,
    templateId: null,
    routingReason: 'No matching template found',
  };

  return { text: result.text, trace };
}

function estimateCost(
  usage: any,
  model: string,
): number {
  if (!usage) return 0;
  const rates: Record<string, { input: number; output: number }> = {
    'anthropic/claude-sonnet-4-20250514': { input: 3, output: 15 },
    'anthropic/claude-haiku-4-5-20251001': { input: 0.8, output: 4 },
  };
  const rate = rates[model] ?? { input: 3, output: 15 };
  return (
    ((usage.promptTokens ?? 0) * rate.input +
     (usage.completionTokens ?? 0) * rate.output) / 1_000_000
  );
}
