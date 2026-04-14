# README Design — muscle-memory

**Date:** 2026-04-14
**Status:** Approved outline, ready for implementation plan
**Owner:** Pascal

## Goal

Replace the current feature-reference README with a layered document that:
1. Hooks judges / first-time visitors in the first 15 lines by leading with the **learning loop** (traces → cron job → compiled templates) and a benchmark table.
2. Gives developers enough technical depth below the fold to evaluate for real use.

Keep it minimal. Every section earns its place.

**Framing rule:** do NOT sell this as "wrap a function." The wrapper is an implementation detail, not a value prop. The value prop is: your agent has a learning job that runs in the background and makes it faster over time.

## Audience

- **Primary:** hackathon judges and devs landing on the repo cold.
- **Secondary:** devs evaluating muscle-memory for a real project — need architecture clarity, config, failure modes.

Single document, layered top-to-bottom: pitch → proof → docs.

## Structural approach

**Pitch → Proof → Docs** (linear). Judges stop after the benchmark table; devs keep reading into quickstart, `learn()`, config, metrics. No before/after split columns (breaks on mobile), no narrative intro (buries install).

## Section outline

In order. Content notes describe intent, not final copy.

### 1. Title + tagline
- `# muscle-memory`
- One line: *Agents that learn. A background job turns repeated traces into compiled templates — every call after that is ~20x faster and ~20x cheaper.*
- No mention of wrapping, SDKs, or `generateText` in the tagline.

### 2. Hero visual slot
- Placeholder: `[IMG: side-by-side gif — Phase 1 (thinking, ~4s) vs Phase 3 (instant, ~200ms)]`
- Asset spec: terminal recording of the demo app, two panels, same prompt, shows latency badges. To be produced after demo is built.

### 3. Install + minimal usage
- `npm install muscle-memory`
- Short snippet (~5–8 lines) showing the agent being called like normal. Do NOT narrate this as "wrapping" — just show it working. No "same API as generateText" framing. The reader should see: import, call, get a result with a phase badge on it.

### 4. The numbers
Compact 3-column table:

| | Latency | Cost | Model |
|---|---|---|---|
| First calls | ~4s | ~$0.02 | full LLM |
| After learning | ~200ms | ~$0.001 | deterministic + tiny LLM fallback |

No claims beyond what the current implementation actually delivers. Numbers come from the README's existing figures — if measured numbers from the demo differ, update before shipping.

### 5. How it works
- Placeholder: `[IMG: architecture diagram — trace → cluster → DAG → template; match → extract args → walk graph]`
- Asset spec: clean SVG or PNG, replaces the ASCII diagram in the current README.
- 3–4 sentences of prose: every call is traced; a background `learn()` step clusters similar traces and compiles a DAG template; matching prompts skip the LLM and walk the graph deterministically, with a tiny model only for arg extraction fallback.
- First place the term "Phase 1 / Phase 3" is introduced.

### 6. Quickstart
- One complete, copy-pasteable example (~20 lines): imports, tool definitions (re-use `get_order` / `cancel_order` / `process_refund` from current README), a `generate(...)` call, logging `result.text` and `result.experimental_muscle_memory?.phase`.

### 7. The learning job (hero section — promote above Quickstart if possible)
- This is the differentiator. Treat it as such.
- Lead with the cron one-liner:
  ```
  0 * * * * node scripts/learn.js
  ```
- Then the `learn()` call (6-ish lines): point it at the same SQLite file the agent writes to, set `minTraces` and `confidence`, let it run.
- One sentence on what it does: clusters semantically-similar traces, compiles each cluster into a DAG template, marks it active once confidence is high enough.
- Do NOT mention "Option A / Option B" or inline learning. One path only: it's a background job.

### 8. Configuration
Compact table: option / default / purpose. Covers `db`, `minTraces`, `confidence`, `similarity`, `learnInline`. No prose.

### 9. Monitoring
Six lines max: `.metrics()` output shape + `result.experimental_muscle_memory` fields. `.invalidate(templateId)` gets one line.

### 10. When not to use this
Three bullets. Candidate list (pick the sharpest three):
- Non-deterministic tools (responses differ between calls for the same inputs)
- Fast-changing downstream APIs (template drift risk; no drift detector yet)
- One-shot or highly variable prompts (never enough similar traces to cluster)

### 11. Status
One line: "Hackathon project. Experimental. Expect sharp edges." Links to issues.

### 12. Credits
Team line.

## Image assets (deferred)

Two placeholder slots, both marked clearly in the rendered README so they don't ship as broken images:

1. **Hero gif** — side-by-side Phase 1 vs Phase 3 terminal recording. Blocked on demo being built.
2. **Architecture diagram** — replaces current ASCII art. Can be produced independently from the demo.

Placeholder format in the markdown: an HTML comment `<!-- IMG: ... -->` plus a visible italic line *"(diagram coming soon)"* so the README reads cleanly without a broken image tag.

## Explicit non-goals

- No "wrap your function" framing anywhere in the pitch.
- No "Option A / Option B" patterns. One recommended path per feature.
- No inline-learning path in the README (it exists in code; it's not the story).
- No before/after two-column code layout (mobile rendering).
- No narrative/story intro.
- No full API reference — link to source if needed.
- No deep architecture dive — the "How it works" section is 4 sentences, not a whitepaper.
- No FAQ section — "When not to use this" covers the honest-gesture role.

## Open questions

None blocking. Numbers in the benchmark table should be verified against measured demo output before publishing.
