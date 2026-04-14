<p align="center">
  <img src="public/muscle.jpeg" alt="muscle-memory" width="200" />
</p>

# muscle-memory

**Agents that learn.** Your agent did this yesterday — why is it still thinking? muscle-memory turns repeated calls into instant, deterministic actions. ~20× faster. ~20× cheaper. No prompt changes.

<!-- IMG: side-by-side gif — first call (thinking, ~4s) vs learned call (instant, ~200ms) -->
*(demo gif coming soon)*

```bash
npm install muscle-memory
```

---

## The numbers

|                  | Latency  | Cost      | How                                      |
| ---------------- | -------- | --------- | ---------------------------------------- |
| First calls      | ~4s      | ~$0.02    | full LLM reasoning                       |
| After learning   | ~200ms   | ~$0.001   | deterministic graph walk + tiny fallback |

Same outputs. Same tools. 20× the economics.

---

## Quickstart

```typescript
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { withMemory } from 'muscle-memory';

const generate = withMemory(generateText);

const result = await generate({
  model: anthropic('claude-sonnet-4-20250514'),
  tools: { get_order, cancel_order, process_refund },
  prompt: 'Cancel my order ORD-412',
});

console.log(result.text);
// "Order ORD-412 has been cancelled. Refund of $59.99 will arrive in 3-5 days."

console.log(result.experimental_muscle_memory?.phase);
// 1 → full LLM     (first few calls)
// 3 → muscle memory (after learning kicks in)
```

---

## The learning job

A background job reads the traces your agent has written, clusters similar ones, and compiles each cluster into a DAG template. Matching prompts then skip the LLM entirely.

```typescript
import { learn } from 'muscle-memory';

await learn({
  db: './muscle-memory.db',
  minTraces: 5,       // traces needed before a template is created
  confidence: 0.90,   // confidence required to serve from memory
});
```

Run it on a cron, a worker, or after each batch:

```bash
0 * * * * node scripts/learn.js
```

No impact on the request path.

---

## How it works

<!-- IMG: architecture diagram — trace → cluster → DAG → template; match → extract args → walk graph -->

```
Request
   │
   ├─ embed(prompt) ── match template? ──┐
   │                                      │
   NO                                    YES (sim ≥ 0.85, conf ≥ 0.90)
   │                                      │
   ▼                                      ▼
 Full LLM                             Extract args (regex → tiny LLM fallback)
 tools + reasoning                    Walk the compiled graph
 ~4s, ~$0.02                          ~200ms, ~$0.001
   │                                      │
   ▼                                      ▼
 save trace ─────────────────────────▶ return result
   │
   └─ learn() ── clusters traces ── extracts DAG ── activates template
```

Every call is traced. The learning job clusters them by embedding similarity, asks a planner LLM once to extract the shared execution DAG, and stores it. Matching prompts then run deterministically against the graph.

---

## Configuration

| Option        | Default                | Purpose                                       |
| ------------- | ---------------------- | --------------------------------------------- |
| `db`          | `./muscle-memory.db`   | SQLite path (agent and `learn()` share it)    |
| `minTraces`   | `3`                    | Traces required before a template is created  |
| `confidence`  | `0.90`                 | Minimum template confidence to serve a call   |
| `similarity`  | `0.85`                 | Embedding match threshold for template lookup |

---

## Monitoring

```typescript
generate.metrics();
// { total: 1200, byPhase: [
//     { phase: 1, c: 340, avgLat: 4200, avgCost: 0.021 },
//     { phase: 3, c: 860, avgLat: 180,  avgCost: 0.001 },
//   ], successRate: 0.98 }

result.experimental_muscle_memory?.phase     // 1 | 3
result.experimental_muscle_memory?.latencyMs
result.experimental_muscle_memory?.costUsd

generate.invalidate(templateId);  // after an API change
```

---

## Credits

Built at [hackathon name] by [team].
