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
  tools: { get_order, cancel_order, process_refund },
  prompt: 'Cancel my order ORD-412',
});

console.log(result.text);
// "Order ORD-412 has been cancelled. Refund of $59.99 will arrive in 3-5 days."

// Optional: check which phase handled it
console.log(result.experimental_muscle_memory?.phase);
// Request #1-5: 1 (full LLM, ~4s, ~$0.02)
// Request #6+:  3 (muscle memory, ~200ms, ~$0.001)
```

That's it. `result.text` works exactly like before. Your tools, your model, your prompts. Nothing else changes.

## 2. Teach it

After your agent handles enough requests, run the learning pipeline. This clusters similar traces and extracts reusable execution templates.

**Option A -- Background job (recommended)**

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

**Option B -- Inline learning (for prototypes)**

The agent checks after every Phase 1 execution if it can learn. Simpler, but adds ~200ms to the first N requests.

```typescript
const generate = withMemory(generateText, {
  learnInline: true,   // check for patterns after every Phase 1 execution
  minTraces: 5,
});
```

## 3. Monitor (optional)

```typescript
// Metrics
generate.metrics();
// {
//   total: 1200,
//   byPhase: [
//     { phase: 1, c: 340, avgLat: 4200, avgCost: 0.021 },
//     { phase: 3, c: 860, avgLat: 180,  avgCost: 0.001 },
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
 ~4s, ~$0.02                          ~200ms, ~$0.001
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
  learnInline: false,        // learn on every request (default: false)
});
```

## Demo

```bash
cd demo && npm install && npm run dev
```

Interactive demo showing Phase 1 vs Phase 3 side by side.
