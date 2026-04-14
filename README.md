# muscle-memory

Agents that learn. Wrap AI SDK's `generateText` — your agent gets faster and cheaper with every request.

```bash
npm install muscle-memory
```

## 1. Wrap your agent

```typescript
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { withMemory } from 'muscle-memory';

// One line. Same API as generateText.
const generate = withMemory(generateText);

const result = await generate({
  model: anthropic('claude-sonnet-4-20250514'),
  tools: { get_order, cancel_order, refund_payment },
  prompt: 'Cancel my order ORD-412',
});

console.log(result.text);
// "Order ORD-412 has been cancelled. Refund of $59.99 will arrive in 3-5 days."

// Optional: check which phase handled it
console.log(result.experimental_muscle_memory?.phase);
// First requests for a new intent: 1 (full LLM, ~4.2s, ~$0.021)
// Once a template is learned:      3 (muscle memory, ~1.8s, ~$0.008)
```

That's it. `result.text` works exactly like before. Your tools, your model, your prompts. Nothing else changes.

## 2. Teach it

After your agent handles enough requests, run the learning pipeline. This clusters similar traces and extracts reusable execution templates.

Run as a cron job, worker, or script. Doesn't touch the request path.

```typescript
import { learn } from 'muscle-memory';

// Run every hour, or after a batch of requests
await learn({
  db: './muscle-memory.db',     // same db your agent uses
  minTraces: 5,                 // require 5 similar traces before learning
  confidence: 0.90,             // confidence threshold for templates
});
```

Example cron:
```bash
# Every hour
0 * * * * node scripts/learn.js
```

## 3. Monitor (optional)

```typescript
// Metrics
generate.metrics();
// {
//   total: 1000,
//   byPhase: [
//     { phase: 1, c: 178, avgLat: 4200, avgCost: 0.021 },
//     { phase: 3, c: 822, avgLat: 1800, avgCost: 0.008 },
//   ],
//   successRate: 0.98
// }

// Per-request metadata
const result = await generate({ model, tools, prompt });
result.experimental_muscle_memory?.phase     // 1 or 3
result.experimental_muscle_memory?.latencyMs // actual ms
result.experimental_muscle_memory?.costUsd   // actual cost

// Invalidate a template (e.g. after an API change)
generate.invalidate(templateId);
```

## What happens inside

```
Request arrives
     |
     v
  ┌─ embed(prompt) ─── match template? ─┐
  |                                      |
  NO                                    YES (confidence > 0.90)
  |                                      |
  v                                      v
 Phase 1                              Phase 3
 AI SDK generateText()                extract args (regex or small LLM)
 full reasoning + tools               walk the graph deterministically
 ~4.2s, ~$0.021                       ~1.8s, ~$0.008
  |                                      |
  v                                      v
 save trace ──────────────────────> return result
     |
  learn() ─── clusters traces ─── extracts DAG ─── creates template
                                                         |
                                                    unlocks Phase 3
                                                    for this intent
```

## Configuration

```typescript
const generate = withMemory(generateText, {
  db: './muscle-memory.db',  // SQLite path (default: ./mithril.db)
  minTraces: 5,              // traces needed before learning (default: 3)
  confidence: 0.90,          // Phase 3 confidence threshold (default: 0.90)
  similarity: 0.85,          // embedding match threshold (default: 0.85)
});
```

## Benchmark

1000 queries across 20 intents against a 128-tool e-commerce catalog, run on `gpt-5.4`. Each query is executed twice — once through plain `generateText`, once through `muscleMemory` — so the numbers are head-to-head on identical prompts.

| metric           | without muscle memory | with muscle memory |
| ---------------- | --------------------- | ------------------ |
| avg latency      | 4.2s                  | 1.8s               |
| avg cost / query | $0.021                | $0.008             |
| total tokens     | 2.4M                  | 432K               |
| Phase 3 hits     | —                     | 822 / 1000         |

**2.3× faster · 62% cheaper · 82% fewer tokens.**

Reproduce:
```bash
npm install
OPENAI_API_KEY=… npm run benchmark
```

Source: `tests/benchmark/run.ts`. Tool catalog: `tests/benchmark/tools.ts`. Query set: `tests/benchmark/queries.ts`.

## Demo

```bash
cd demo && npm install && npm run dev
```

Five-slide walkthrough of Phase 1 → learning → Phase 3, backed by the real query set and benchmark numbers above.
