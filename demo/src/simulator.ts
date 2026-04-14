import { TOOL_NAMES, inferPattern, getToolsForPattern, BENCHMARK_STATS } from './benchmarkData';

export interface SimStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done';
  startedAt?: number;
  completedAt?: number;
  data?: Record<string, any>;
}

export interface SimResult {
  steps: SimStep[];
  totalMs: number;
  cost: number;
  llmCalls: number;
  response: string;
}

// Tool catalog — the real 128 tools from the benchmark (tests/benchmark/tools.ts).
export const TOOL_CATALOG: string[] = TOOL_NAMES;

// Tool chain for a message = benchmark pattern → known tool chain.
function getToolsForMessage(message: string): string[] {
  return getToolsForPattern(inferPattern(message));
}

function getResponseForMessage(message: string): string {
  const pattern = inferPattern(message);
  switch (pattern) {
    case 'cancel_order':        return 'Order cancelled successfully. Refund of $89.99 will be processed within 3-5 business days.';
    case 'track_order':         return 'Your order is currently in transit. Estimated delivery: April 16, 2026.';
    case 'return_item':         return 'Return label generated and sent to your email. Please ship within 14 days.';
    case 'process_refund':
    case 'get_refund_status':   return 'A refund of $89.99 has been initiated to your original payment method.';
    case 'get_order_invoice':   return 'Invoice emailed. Total: $89.99 incl. tax.';
    case 'check_stock':         return 'Product is in stock — 23 units available.';
    case 'add_to_cart':         return 'Added to your cart. Cart total: $89.99.';
    case 'apply_coupon':        return 'Coupon applied. You saved $9.00.';
    case 'check_order_status':  return 'Order status: processing. Estimated ship date: tomorrow.';
    default:                    return 'Request processed successfully. A confirmation has been sent to your email.';
  }
}

// Per-query averages from the benchmark.
const P1_COST = BENCHMARK_STATS.totalCostWithout / BENCHMARK_STATS.totalQueries;
const P3_COST = BENCHMARK_STATS.totalCostWith / BENCHMARK_STATS.totalQueries;

// Simulate Phase 1: Full LLM (slow, expensive)
export function simulatePhase1(
  message: string,
  onStep: (stepId: string, status: 'active' | 'done', data?: Record<string, any>) => void,
): Promise<SimResult> {
  const tools = getToolsForMessage(message);
  const response = getResponseForMessage(message);

  return new Promise(resolve => {
    const startTime = Date.now();
    let elapsed = 0;

    setTimeout(() => onStep('intent', 'active'), elapsed);
    elapsed += 500;
    setTimeout(() => onStep('intent', 'done', { intent: inferPattern(message) }), elapsed);

    elapsed += 200;
    setTimeout(() => onStep('reasoning', 'active'), elapsed);
    elapsed += 2000;
    setTimeout(() => onStep('reasoning', 'done', { plan: tools }), elapsed);

    for (let i = 0; i < tools.length; i++) {
      elapsed += 200;
      const toolId = `tool_${i}`;
      setTimeout(() => onStep(toolId, 'active', { name: tools[i] }), elapsed);
      elapsed += 400;
      setTimeout(() => onStep(toolId, 'done', { name: tools[i], success: true }), elapsed);
    }

    elapsed += 200;
    setTimeout(() => onStep('response', 'active'), elapsed);
    elapsed += 500;
    setTimeout(() => {
      onStep('response', 'done');
      resolve({
        steps: [],
        totalMs: Date.now() - startTime,
        cost: P1_COST,
        llmCalls: 1 + tools.length,
        response,
      });
    }, elapsed);
  });
}

// Simulate Phase 3: Muscle Memory (fast, cheap)
export function simulatePhase3(
  message: string,
  onStep: (stepId: string, status: 'active' | 'done', data?: Record<string, any>) => void,
): Promise<SimResult> {
  const pattern = inferPattern(message);
  const tools = getToolsForMessage(message);
  const response = getResponseForMessage(message);

  return new Promise(resolve => {
    const startTime = Date.now();
    let elapsed = 0;

    setTimeout(() => onStep('embedding', 'active', { similarity: 0.94 }), elapsed);
    elapsed += 30;
    setTimeout(() => onStep('embedding', 'done', { similarity: 0.94 }), elapsed);

    elapsed += 20;
    setTimeout(() => onStep('template', 'active', { confidence: 0.97, name: pattern }), elapsed);
    elapsed += 20;
    setTimeout(() => onStep('template', 'done', { confidence: 0.97, name: pattern }), elapsed);

    elapsed += 10;
    setTimeout(() => onStep('extraction', 'active'), elapsed);
    elapsed += 80;
    // Try to extract an order id from the message for realism.
    const idMatch = message.match(/ORD-?(\d+)|\b(\d{3,})\b/i);
    const extracted = idMatch ? { order_id: `ORD-${idMatch[1] ?? idMatch[2]}` } : {};
    setTimeout(() => onStep('extraction', 'done', extracted), elapsed);

    for (let i = 0; i < tools.length; i++) {
      elapsed += 10;
      const toolId = `tool_${i}`;
      setTimeout(() => onStep(toolId, 'active', { name: tools[i] }), elapsed);
      elapsed += 20;
      setTimeout(() => onStep(toolId, 'done', { name: tools[i], success: true }), elapsed);
    }

    elapsed += 10;
    setTimeout(() => {
      onStep('response', 'done');
      resolve({
        steps: [],
        totalMs: Date.now() - startTime,
        cost: P3_COST,
        llmCalls: 0,
        response,
      });
    }, elapsed);
  });
}
