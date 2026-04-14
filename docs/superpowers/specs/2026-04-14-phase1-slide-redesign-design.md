# Phase 1 Slide Redesign — Design Spec

**Date:** 2026-04-14
**Scope:** `demo/src/slides/Phase1Slide.tsx` + minor additions to `demo/src/nodeStyles.ts`

## Goal

Elevate the second slide ("Phase 1 — Full LLM") to Apple-level design quality. The slide must be memorable, read top-to-bottom as a single story, and make the LLM's work feel *impressive and expensive* — both what the LLM can do and what it costs.

Current problems the redesign solves:

- Six boxes share nearly identical silhouettes; color tints alone don't give them distinct identities.
- The 128-tool grid floats disconnected in the top-right, breaking composition.
- Animation is generic fade-ins with random flicker; no signature beat, no shared-element transitions.

## Narrative role

**Impressive and expensive.** The LLM should look like a skilled operator doing real work, with the cost visible. This sets up Phase 3 to feel like a revelation without making Phase 1 feel dumb.

## Design principles

1. **One strong primitive, one signature gesture per variant.** Shared chassis (header, status dot, corner radius family) so the family reads instantly. Each box type gets exactly one distinctive internal element — never two.
2. **No drop shadows.** Depth from border weight and fill tone. Flat, like Linear or Sonos.
3. **Pacing is deliberate.** ~8s total, ease-out or ease-in-out on everything. Nothing linear, nothing rushed.
4. **Shared-element transitions.** Grid cells physically become tool cards — the viewer sees the same object change roles.

## Layout & composition

Single vertical spine, centered. Total SVG ~960×620.

```
             ┌─────────────────────────┐
             │  CUSTOMER MESSAGE       │   narrow, quoted
             └─────────────┬───────────┘
                           │
    ┌──────────────────────┴──────────────────────┐
    │  LLM REASONING                              │   dominant (≈2× taller)
    │  ┌──────────────┐  ┌────────────────────┐   │
    │  │ 128-tool     │  │ thought tokens     │   │
    │  │ grid         │  │ cost meter         │   │
    │  └──────────────┘  └────────────────────┘   │
    └────────┬──────────┬──────────┬──────────────┘
             │          │          │
        ┌────▼───┐ ┌────▼────┐ ┌───▼──────┐
        │ TOOL 1 │ │ TOOL 2  │ │ TOOL 3   │   terminal cards
        └────┬───┘ └────┬────┘ └───┬──────┘
             └──────────┼──────────┘
                        │
             ┌──────────▼──────────┐
             │  RESPONSE (receipt) │
             └─────────────────────┘
```

The LLM box is the visual center of gravity, matching its narrative role.

### Approximate coordinates

- Customer message: `x=350, y=20, w=260, h=90`
- LLM reasoning: `x=140, y=150, w=680, h=230` (wide + tall; contains the grid)
  - Internal grid pane: left half, ~320×200
  - Internal thought/cost pane: right half, ~320×200
- Tool cards: `y=420, h=90`, three cards spaced across the full width (roughly `x=170/400/630, w=160`)
- Response: `x=350, y=540, w=260, h=100`

Final values tuned during implementation; these are the starting frame.

## Shared chassis

Every box uses the same primitives. Deviations are deliberate and rare.

- **Header strip**: 28px tall, dark (`#1a1a1a`), 10px mono label in white. Status dot left, checkmark right when done.
- **Corner radius family**: 8px default. Tool cards are the single exception at 4px (sharper = machine).
- **Border**: 1px, consistent weight. Variants diverge on *style* (solid / dashed / inverted-dark), not weight.
- **Status dot states**: `idle` grey · `active` amber with slow breathing pulse · `done` green steady. Three states, three colors, everywhere.
- **No drop shadows anywhere.**

## Per-box signature gestures

### Customer message — the *quoted* card
- Soft blue tint, rounded, left accent bar (retained from current).
- Body: italic pulled quote. A subtle large open-quote mark (low-contrast grey) sits top-left inside the body.
- Entry: fade in + 2px upward drift, 300ms ease-out.

### LLM reasoning — the *workspace* (hero)
- Wider and taller than everything else. Dashed purple border.
- **Left pane**: 128-tool grid embedded with a `128 TOOLS` label above. Cells 18×12, 3px gap, 8 cols × 16 rows.
- **Right pane**: live thought stream. Mono text lines typewriter in (`> parsing intent…`, `> matching: order ops…`, `> candidates: 7 → 3`). Max 4 lines visible, older lines fade upward.
- **Bottom strip**: a cost meter. `TOKENS 0 → 842` and `$0.000 → $0.021` ticking up in sync, with a thin progress bar underneath.
- Breathing: 1% opacity pulse on the dashed border while active; stops at `done`.

### Tool execution — *terminal cards*
- Sharp corners (4px), inverted dark body, light mono text.
- Each card streams a single output line on execute:
  - `GET_ORDER` → `→ order.status = "shipped"`
  - `CANCEL_ORDER` → `→ cancelled ✓`
  - `PROCESS_REFUND` → `→ refund $89.00 queued`
- Amber tick (3×8px) in top-left as the tool signature. This replaces the current "three identical dark boxes" — each card now earns its screen time via content.

### Response — the *receipt*
- Green-tinted, bottom accent bar (retained).
- Body is a structured 3-row receipt (not centered text):
  ```
  time     4.2s
  cost     $0.021
  status   ✓ complete
  ```
- Right-aligned values, mono, subtle dividers between rows.
- Entry: rows write in sequentially; bottom bar wipes left-to-right last as the "seal."

## Animation choreography

Total runtime ~8s. All timings are ease-out or ease-in-out unless noted. Nothing is linear.

| t (s) | Beat | Detail |
|---|---|---|
| 0.0 | Customer appears | Fade + 2px drift-up, 300ms. Quote mark fades in 100ms later. |
| 0.6 | Edge draws (customer → LLM) | Stroke-dashoffset animates to 0 (top → down), 400ms. |
| 1.0 | LLM materializes | Box fades in; dashed border begins breathing pulse. Status dot → amber. |
| 1.3 | Grid reveals | Cells cascade in on a diagonal wipe (TL → BR), 30ms stagger. |
| 1.8 | Scan sweep begins | Soft wavefront moves column-by-column across the grid; each passed cell brightens then fades. Three full sweeps, ~2.5s total. Not random — a search. |
| 1.8 | Thought stream starts | Token lines typewriter in, one per ~500ms. Cost meter and token counter tick in sync. |
| 4.3 | Three cells catch | On the final sweep, three specific cells stay solid black with a crisp 150ms scale bump. Grid stops. Status dot → green. |
| 4.6 | **Crystallize-and-detach** (hero) | The 3 selected cells simultaneously translate from their grid positions down to the tool-card slots, scale from 18×12 → full card size, and transition fill from solid black cell → dark terminal card with header strip materializing. 600ms, cubic-bezier(0.4, 0, 0.2, 1). The cells *are* the cards. |
| 5.2 | Tool outputs stream | Each card's output line typewriter-ins, 150ms staggered. Status dots amber → green as each finishes. |
| 6.0 | Converge edges draw | Three paths stroke tool cards → response, 400ms. |
| 6.4 | Response assembles | Box fades in. Receipt rows write sequentially (time → cost → status), 120ms each. |
| 6.9 | Green seal wipes | Bottom bar wipes left-to-right, 500ms. Checkmark pops on `status` row last. |
| 7.4 | Settle | Steady state. Cost meter remains at `$0.021`. |

### Narration cues

Fire `onNarrate` at four beats, matched to the four acts:

- 0.0s — `Request received: Cancel my order ORD-412`
- 1.3s — `LLM scanning 128 tools...`
- 4.3s — `3 tools selected. Executing plan...`
- 6.4s — `Response generated. 4.2s, $0.021 per request`

## Scope

**In scope**:
- `demo/src/slides/Phase1Slide.tsx` — full rewrite of the slide.
- `demo/src/nodeStyles.ts` — add body-treatment helpers if needed (e.g. a `workspace` variant); keep existing categories usable.

**Out of scope**:
- Matching updates to Phase3 or other slides. Separate follow-up after this chassis is validated.
- Changes to `App.tsx`, hero slide, narration banner, or routing.

## Open questions / risks

- **Grid cascade timing**: 30ms × 128 cells = 3.8s; too slow. Use diagonal wipe with banded stagger (whole diagonals light together) so total cascade lands under 500ms.
- **Crystallize-and-detach feasibility in SVG**: requires coordinated transform on individual `<rect>` elements. Viable via CSS transforms on grouped `<g>` nodes, with `transform-box: fill-box` and explicit transform-origins. Fallback: cross-fade between grid-cells and tool-cards at matched positions if transform animation proves jittery.
- **Typewriter performance**: rendering live mono text in SVG has historically been fine at this scale (~4 lines, ~40 chars), but keep update cadence to ≥50ms to avoid thrash.
