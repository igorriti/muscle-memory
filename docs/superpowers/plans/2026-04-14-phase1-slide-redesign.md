# Phase 1 Slide Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the second slide ("Phase 1 — Full LLM") to Apple-level design quality: shared chassis, signature gestures per box type, tool grid embedded inside the LLM reasoning workspace, and a choreographed animation whose hero beat is three grid cells detaching and becoming the three tool-execution cards.

**Architecture:** Single `Phase1Slide.tsx` owns the full SVG scene. Nodes are rendered as typed, position-aware data plus per-variant render functions (no shared `NODE_STYLES` lookup — each variant is bespoke enough that inlining its treatment is clearer than parameterizing). A single `useEffect` drives a scheduled timeline of state updates; CSS handles micro-animations (fades, breathing, typewriter caret), React controls macro timing. Shared CSS keyframes live in `styles.css`.

**Tech Stack:** React 19, TypeScript 5.5, Vite 6, inline SVG, CSS keyframes. No test framework in this project — verification is visual via `npm run dev`.

---

## File structure

- **Modify:** `demo/src/slides/Phase1Slide.tsx` — full rewrite. Owns all new layout, per-box render functions, timeline effect, and shared-element detach animation.
- **Modify:** `demo/src/styles.css` — add keyframes for breathing border, grid cell wave flash, typewriter caret, and receipt row reveal.
- **Not modified:** `demo/src/nodeStyles.ts` — the new design diverges enough that reusing this abstraction hurts clarity. We leave it alone (still used by other slides).
- **Not modified:** `demo/src/App.tsx`, other slides.

Each task below produces a visually testable milestone. After each task, run `npm run dev` from `demo/`, navigate to slide 2 (second dot in the top-right), and confirm the described behavior before committing.

---

## Task 1: Scaffold new layout skeleton

**Files:**
- Modify: `demo/src/slides/Phase1Slide.tsx` (full rewrite)

Replace the current slide with a new skeleton that uses the target coordinates and renders empty/placeholder boxes. No animations yet — we get the composition right first.

- [ ] **Step 1: Replace the file contents**

```tsx
import { useEffect, useRef, useState, useCallback } from 'react';

interface SlideProps {
  active: boolean;
  onComplete: () => void;
  onNarrate: (text: string) => void;
}

type Phase = 'idle' | 'customer' | 'llm-scanning' | 'llm-selected' | 'tools-executing' | 'response' | 'done';

// Layout constants (SVG coordinates, viewBox 0 0 960 620)
const CUSTOMER = { x: 350, y: 20, w: 260, h: 90 };
const LLM = { x: 140, y: 140, w: 680, h: 250 };
const LLM_GRID_PANE = { x: LLM.x + 20, y: LLM.y + 50, w: 320, h: 170 };
const LLM_THOUGHT_PANE = { x: LLM.x + 360, y: LLM.y + 50, w: 300, h: 140 };
const LLM_COST_STRIP = { x: LLM.x + 360, y: LLM.y + 200, w: 300, h: 20 };

const TOOL_Y = 430;
const TOOL_H = 90;
const TOOL_W = 170;
const TOOLS = [
  { id: 'get_order', label: 'GET_ORDER', x: 170, output: '→ order.status = "shipped"' },
  { id: 'cancel_order', label: 'CANCEL_ORDER', x: 395, output: '→ cancelled ✓' },
  { id: 'process_refund', label: 'PROCESS_REFUND', x: 620, output: '→ refund $89.00 queued' },
];

const RESPONSE = { x: 350, y: 550, w: 260, h: 100 };

// Tool grid (inside LLM_GRID_PANE)
const GRID_COLS = 8;
const GRID_ROWS = 16;
const GRID_CELL_W = 18;
const GRID_CELL_H = 9;
const GRID_GAP = 3;
const GRID_ORIGIN_X = LLM_GRID_PANE.x + (LLM_GRID_PANE.w - (GRID_COLS * (GRID_CELL_W + GRID_GAP) - GRID_GAP)) / 2;
const GRID_ORIGIN_Y = LLM_GRID_PANE.y + 20;
const SELECTED_CELLS = [19, 54, 87]; // which cells become tools

const HEADER_H = 28;
const HEADER_FILL = '#1a1a1a';

export function Phase1Slide({ active, onComplete, onNarrate }: SlideProps) {
  const [phase, setPhase] = useState<Phase>('idle');

  useEffect(() => {
    if (!active) {
      setPhase('idle');
      return;
    }
    setPhase('customer');
    onNarrate('Request received: Cancel my order ORD-412');
  }, [active]);

  return (
    <div className="slide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={960} height={680} viewBox="0 0 960 680">
        {/* Customer message placeholder */}
        <rect x={CUSTOMER.x} y={CUSTOMER.y} width={CUSTOMER.w} height={CUSTOMER.h}
              rx={8} fill="#eff3ff" stroke="#c7d7fe" strokeWidth={1} />
        <rect x={CUSTOMER.x} y={CUSTOMER.y} width={CUSTOMER.w} height={HEADER_H}
              rx={8} fill={HEADER_FILL} />
        <rect x={CUSTOMER.x} y={CUSTOMER.y + HEADER_H - 8} width={CUSTOMER.w} height={8} fill={HEADER_FILL} />

        {/* LLM workspace placeholder */}
        <rect x={LLM.x} y={LLM.y} width={LLM.w} height={LLM.h}
              rx={8} fill="#f6f2ff" stroke="#cbb8ff" strokeWidth={1} strokeDasharray="6,3" />
        <rect x={LLM.x} y={LLM.y} width={LLM.w} height={HEADER_H}
              rx={8} fill={HEADER_FILL} />
        <rect x={LLM.x} y={LLM.y + HEADER_H - 8} width={LLM.w} height={8} fill={HEADER_FILL} />

        {/* Tool card placeholders */}
        {TOOLS.map(t => (
          <g key={t.id}>
            <rect x={t.x} y={TOOL_Y} width={TOOL_W} height={TOOL_H}
                  rx={4} fill="#282835" stroke="#3a3a48" strokeWidth={1} />
            <rect x={t.x} y={TOOL_Y} width={TOOL_W} height={HEADER_H}
                  rx={4} fill={HEADER_FILL} />
          </g>
        ))}

        {/* Response placeholder */}
        <rect x={RESPONSE.x} y={RESPONSE.y} width={RESPONSE.w} height={RESPONSE.h}
              rx={8} fill="#effdf4" stroke="#86efac" strokeWidth={1} />
        <rect x={RESPONSE.x} y={RESPONSE.y} width={RESPONSE.w} height={HEADER_H}
              rx={8} fill={HEADER_FILL} />
        <rect x={RESPONSE.x} y={RESPONSE.y + HEADER_H - 8} width={RESPONSE.w} height={8} fill={HEADER_FILL} />
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Start dev server and verify**

Run from `demo/`: `npm run dev`
Open the URL, navigate to slide 2 (press right arrow once or click the second dot). Confirm:
- One narrow customer box on top (blue tint)
- One wide LLM box in the middle (purple tint, dashed border)
- Three dark tool cards below the LLM box, evenly spaced
- One response box (green tint) at the bottom
- No overlap, everything visible within viewport

- [ ] **Step 3: Commit**

```bash
git add demo/src/slides/Phase1Slide.tsx
git commit -m "feat(slide2): scaffold new Phase 1 layout"
```

---

## Task 2: Shared chassis helper + status dots

**Files:**
- Modify: `demo/src/slides/Phase1Slide.tsx`

Extract a `BoxHeader` helper that every variant uses. It renders the dark header strip, the status dot on the left, and the optional checkmark on the right. This is the "family" glue.

- [ ] **Step 1: Add the helper above the `Phase1Slide` component**

```tsx
type Status = 'idle' | 'active' | 'done';

function statusColor(s: Status): string {
  if (s === 'active') return '#eab308';
  if (s === 'done') return '#22c55e';
  return '#bbb';
}

interface BoxHeaderProps {
  x: number;
  y: number;
  w: number;
  rx: number;
  label: string;
  status: Status;
  showCheck?: boolean;
}

function BoxHeader({ x, y, w, rx, label, status, showCheck }: BoxHeaderProps) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={HEADER_H} rx={rx} fill={HEADER_FILL} />
      <rect x={x} y={y + HEADER_H - rx} width={w} height={rx} fill={HEADER_FILL} />
      <circle cx={x + 12} cy={y + HEADER_H / 2} r={4}
              fill={statusColor(status)}
              className={status === 'active' ? 'status-pulse' : ''} />
      <text x={x + 24} y={y + HEADER_H / 2 + 1} fontSize={10}
            fontFamily="'Geist Mono', monospace" fill="#fff" dominantBaseline="middle">
        {label}
      </text>
      {showCheck && (
        <text x={x + w - 16} y={y + HEADER_H / 2 + 1} fontSize={12}
              fill="#22c55e" fontFamily="'Geist Mono', monospace" dominantBaseline="middle">
          &#10003;
        </text>
      )}
    </g>
  );
}
```

- [ ] **Step 2: Replace inline header rects with `BoxHeader` calls**

In the JSX, replace each pair of header rects (the `rx` rect + rectangular overlap rect) with a `BoxHeader` invocation. Pass appropriate labels and derive status from `phase`:

```tsx
{/* Customer */}
<rect x={CUSTOMER.x} y={CUSTOMER.y} width={CUSTOMER.w} height={CUSTOMER.h}
      rx={8} fill="#eff3ff" stroke="#c7d7fe" strokeWidth={1} />
<BoxHeader x={CUSTOMER.x} y={CUSTOMER.y} w={CUSTOMER.w} rx={8}
           label="CUSTOMER MESSAGE" status={phase === 'idle' ? 'idle' : 'done'} showCheck={phase !== 'idle'} />

{/* LLM */}
<rect x={LLM.x} y={LLM.y} width={LLM.w} height={LLM.h}
      rx={8} fill="#f6f2ff" stroke="#cbb8ff" strokeWidth={1} strokeDasharray="6,3" />
<BoxHeader x={LLM.x} y={LLM.y} w={LLM.w} rx={8}
           label="LLM REASONING" status={phase === 'llm-scanning' ? 'active' : phase === 'idle' || phase === 'customer' ? 'idle' : 'done'}
           showCheck={phase === 'tools-executing' || phase === 'response' || phase === 'done'} />

{/* Tools */}
{TOOLS.map(t => (
  <g key={t.id}>
    <rect x={t.x} y={TOOL_Y} width={TOOL_W} height={TOOL_H}
          rx={4} fill="#282835" stroke="#3a3a48" strokeWidth={1} />
    <BoxHeader x={t.x} y={TOOL_Y} w={TOOL_W} rx={4}
               label={t.label} status={phase === 'response' || phase === 'done' ? 'done' : phase === 'tools-executing' ? 'active' : 'idle'}
               showCheck={phase === 'response' || phase === 'done'} />
  </g>
))}

{/* Response */}
<rect x={RESPONSE.x} y={RESPONSE.y} width={RESPONSE.w} height={RESPONSE.h}
      rx={8} fill="#effdf4" stroke="#86efac" strokeWidth={1} />
<BoxHeader x={RESPONSE.x} y={RESPONSE.y} w={RESPONSE.w} rx={8}
           label="RESPONSE" status={phase === 'done' ? 'done' : 'idle'} showCheck={phase === 'done'} />
```

- [ ] **Step 2b: Temporarily force the phase for visual check**

At the top of the component, TEMPORARILY (to verify rendering) add: `const [phase, setPhase] = useState<Phase>('done');` so the deck shows the final state. Remove the `useEffect` side effects for now or comment them out.

- [ ] **Step 3: Verify in browser**

Reload the dev server. Slide 2 should show all boxes with green status dots and checkmarks (since phase='done'). No broken rendering.

- [ ] **Step 4: Restore initial phase**

Change back to `useState<Phase>('idle')` and uncomment the `useEffect`. Reload — slide 2 should now show all boxes with grey idle dots and no checkmarks.

- [ ] **Step 5: Commit**

```bash
git add demo/src/slides/Phase1Slide.tsx
git commit -m "feat(slide2): add shared BoxHeader chassis with status dots"
```

---

## Task 3: Customer message body (quoted treatment)

**Files:**
- Modify: `demo/src/slides/Phase1Slide.tsx`

Add the quote mark + italic body. This is the "signature gesture" for the input variant.

- [ ] **Step 1: Add customer body rendering inside the Customer section**

Insert *after* the customer `<rect>` but *before* the `<BoxHeader>`:

```tsx
{/* Customer body */}
<text x={CUSTOMER.x + 14} y={CUSTOMER.y + HEADER_H + 22} fontSize={36}
      fontFamily="Georgia, serif" fill="#c7d7fe" opacity={0.7}>
  &ldquo;
</text>
<text x={CUSTOMER.x + CUSTOMER.w / 2} y={CUSTOMER.y + HEADER_H + (CUSTOMER.h - HEADER_H) / 2 + 4}
      fontSize={14} fontFamily="'Geist', sans-serif" fill="#334"
      fontStyle="italic" textAnchor="middle" dominantBaseline="middle">
  Cancel my order ORD-412
</text>
```

- [ ] **Step 2: Verify**

Reload. The customer box should show a large faint opening quote in the top-left of its body, and the message "Cancel my order ORD-412" centered in italics.

- [ ] **Step 3: Commit**

```bash
git add demo/src/slides/Phase1Slide.tsx
git commit -m "feat(slide2): customer message quote + italic body"
```

---

## Task 4: LLM workspace — grid pane and thought pane structure

**Files:**
- Modify: `demo/src/slides/Phase1Slide.tsx`

Draw the internal structure of the LLM box: the `128 TOOLS` label, the grid of 128 cells, and a right-pane area ready for the thought stream. Cells are static for now (all grey), no cascade animation yet.

- [ ] **Step 1: Add inside the LLM section, after the `<BoxHeader>`**

```tsx
{/* Left pane: tool grid */}
<text x={LLM_GRID_PANE.x + LLM_GRID_PANE.w / 2} y={LLM_GRID_PANE.y + 8}
      fontSize={10} fontFamily="'Geist Mono', monospace" fill="#888"
      textAnchor="middle" letterSpacing={1}>
  128 TOOLS
</text>
{Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, i) => {
  const col = i % GRID_COLS;
  const row = Math.floor(i / GRID_COLS);
  const cx = GRID_ORIGIN_X + col * (GRID_CELL_W + GRID_GAP);
  const cy = GRID_ORIGIN_Y + row * (GRID_CELL_H + GRID_GAP);
  return (
    <rect key={`cell-${i}`} x={cx} y={cy} width={GRID_CELL_W} height={GRID_CELL_H}
          rx={1.5} fill="#e4e0f0" />
  );
})}

{/* Right pane: thought stream placeholder */}
<text x={LLM_THOUGHT_PANE.x} y={LLM_THOUGHT_PANE.y + 8}
      fontSize={10} fontFamily="'Geist Mono', monospace" fill="#888" letterSpacing={1}>
  THOUGHT STREAM
</text>

{/* Bottom cost strip */}
<line x1={LLM_COST_STRIP.x} y1={LLM_COST_STRIP.y - 6}
      x2={LLM_COST_STRIP.x + LLM_COST_STRIP.w} y2={LLM_COST_STRIP.y - 6}
      stroke="#e0d8f0" strokeWidth={1} />
<text x={LLM_COST_STRIP.x} y={LLM_COST_STRIP.y + 4}
      fontSize={10} fontFamily="'Geist Mono', monospace" fill="#666">
  TOKENS 0
</text>
<text x={LLM_COST_STRIP.x + LLM_COST_STRIP.w} y={LLM_COST_STRIP.y + 4}
      fontSize={10} fontFamily="'Geist Mono', monospace" fill="#666" textAnchor="end">
  $0.000
</text>
```

- [ ] **Step 2: Verify**

Reload. The LLM box should now contain: a `128 TOOLS` label on the left, a visible 8×16 grid of pale-purple cells underneath it, a `THOUGHT STREAM` label on the right, and a bottom strip with `TOKENS 0` left-aligned and `$0.000` right-aligned.

- [ ] **Step 3: Commit**

```bash
git add demo/src/slides/Phase1Slide.tsx
git commit -m "feat(slide2): LLM workspace internal structure"
```

---

## Task 5: CSS keyframes for animations

**Files:**
- Modify: `demo/src/styles.css`

Add the keyframes we'll need across subsequent tasks.

- [ ] **Step 1: Append to `demo/src/styles.css`**

```css
/* ── Breathing dashed border (LLM active) ── */
@keyframes breathe {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}
.breathe {
  animation: breathe 1.6s ease-in-out infinite;
}

/* ── Grid cell cascade reveal ── */
@keyframes cellReveal {
  from { opacity: 0; transform: scale(0.4); }
  to { opacity: 1; transform: scale(1); }
}
.cell-reveal {
  transform-box: fill-box;
  transform-origin: center;
  opacity: 0;
  animation: cellReveal 0.22s ease-out forwards;
}

/* ── Grid cell scan flash (during sweep) ── */
@keyframes cellFlash {
  0% { fill: #e4e0f0; }
  35% { fill: #8b5cf6; }
  100% { fill: #e4e0f0; }
}

/* ── Grid cell catch (stays selected) ── */
@keyframes cellCatch {
  0% { transform: scale(1); fill: #8b5cf6; }
  45% { transform: scale(1.35); fill: #1a1a1a; }
  100% { transform: scale(1); fill: #1a1a1a; }
}
.cell-catch {
  transform-box: fill-box;
  transform-origin: center;
  animation: cellCatch 0.18s ease-out forwards;
}

/* ── Typewriter caret blink ── */
@keyframes caretBlink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
.caret {
  animation: caretBlink 0.8s steps(1) infinite;
}

/* ── Receipt row reveal ── */
@keyframes rowReveal {
  from { opacity: 0; transform: translateX(-4px); }
  to { opacity: 1; transform: translateX(0); }
}
.row-reveal {
  opacity: 0;
  animation: rowReveal 0.22s ease-out forwards;
}

/* ── Response seal bar wipe ── */
@keyframes sealWipe {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
.seal-wipe {
  transform-box: fill-box;
  transform-origin: left center;
  animation: sealWipe 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
```

- [ ] **Step 2: Verify**

Reload. No visible change yet (none of the classes are used). Confirm dev server still compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add demo/src/styles.css
git commit -m "feat(slide2): add keyframes for breathing, grid scan, receipt reveals"
```

---

## Task 6: Wire up timeline — customer → LLM → scanning state

**Files:**
- Modify: `demo/src/slides/Phase1Slide.tsx`

Build the scheduled timeline. Begin with customer fade-in, then edge draw, then LLM materialization with breathing border. Grid cells cascade in.

- [ ] **Step 1: Replace the component body to add timeline state and scheduling**

At the top of the component, add additional state and a scheduler ref:

```tsx
const [visibleBoxes, setVisibleBoxes] = useState<Set<string>>(new Set());
const [gridRevealed, setGridRevealed] = useState(false);
const [llmBreathing, setLlmBreathing] = useState(false);
const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

const schedule = useCallback((fn: () => void, ms: number) => {
  const t = setTimeout(fn, ms);
  timersRef.current.push(t);
}, []);
```

Replace the `useEffect` to drive the early timeline:

```tsx
useEffect(() => {
  if (!active) {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setPhase('idle');
    setVisibleBoxes(new Set());
    setGridRevealed(false);
    setLlmBreathing(false);
    return;
  }

  // t=0.0s — customer
  schedule(() => {
    setVisibleBoxes(prev => new Set(prev).add('customer'));
    onNarrate('Request received: Cancel my order ORD-412');
    setPhase('customer');
  }, 0);

  // t=1.0s — LLM materializes
  schedule(() => {
    setVisibleBoxes(prev => new Set(prev).add('llm'));
    setLlmBreathing(true);
    setPhase('llm-scanning');
  }, 1000);

  // t=1.3s — grid cascade
  schedule(() => {
    setGridRevealed(true);
    onNarrate('LLM scanning 128 tools...');
  }, 1300);

  return () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };
}, [active]);
```

- [ ] **Step 2: Wrap each `<g>` or set of rects per box in a parent `<g>` whose visibility is gated**

For customer:
```tsx
<g style={{ opacity: visibleBoxes.has('customer') ? 1 : 0, transition: 'opacity 0.3s ease-out' }}>
  {/* customer rect + body + BoxHeader */}
</g>
```

For LLM, wrap in:
```tsx
<g style={{ opacity: visibleBoxes.has('llm') ? 1 : 0, transition: 'opacity 0.3s ease-out' }}>
  {/* llm rect (add className="breathe" conditionally based on llmBreathing) + internals + BoxHeader */}
</g>
```

The dashed LLM outer rect gets:
```tsx
<rect x={LLM.x} y={LLM.y} width={LLM.w} height={LLM.h}
      rx={8} fill="#f6f2ff" stroke="#cbb8ff" strokeWidth={1} strokeDasharray="6,3"
      className={llmBreathing ? 'breathe' : ''} />
```

For the grid cells, wrap each cell rect with the reveal:
```tsx
{gridRevealed && Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, i) => {
  const col = i % GRID_COLS;
  const row = Math.floor(i / GRID_COLS);
  const cx = GRID_ORIGIN_X + col * (GRID_CELL_W + GRID_GAP);
  const cy = GRID_ORIGIN_Y + row * (GRID_CELL_H + GRID_GAP);
  // Diagonal wipe: delay by (col + row) * 20ms, capped at ~460ms for furthest corner
  const delay = (col + row) * 20;
  return (
    <rect key={`cell-${i}`} x={cx} y={cy} width={GRID_CELL_W} height={GRID_CELL_H}
          rx={1.5} fill="#e4e0f0"
          className="cell-reveal"
          style={{ animationDelay: `${delay}ms` }} />
  );
})}
```

Tool cards and response should remain invisible for now — wrap them in `<g style={{ opacity: 0 }}>` so they don't show.

- [ ] **Step 3: Verify**

Reload. Slide 2 should now animate:
- 0.0s: customer box fades in
- 1.0s: LLM box fades in, dashed border breathing (visible opacity pulse on the border)
- 1.3s: 128 cells cascade in on a diagonal wave, finishing by ~1.8s
- Tool cards and response stay hidden

- [ ] **Step 4: Commit**

```bash
git add demo/src/slides/Phase1Slide.tsx
git commit -m "feat(slide2): timeline through LLM activation + grid cascade"
```

---

## Task 7: Scan sweep animation

**Files:**
- Modify: `demo/src/slides/Phase1Slide.tsx`

Replace random flicker with a column-by-column wavefront. Three full sweeps over ~2.5s.

- [ ] **Step 1: Add scan state and logic**

Add state:
```tsx
const [scanCol, setScanCol] = useState<number | null>(null);
```

Add scheduling in the timeline `useEffect`, after the grid cascade schedule:

```tsx
// t=1.8s — start scan sweeps (3 full sweeps over 2.5s)
schedule(() => {
  let sweepIndex = 0;
  let col = 0;
  const SWEEP_MS = 80; // per column
  const interval = setInterval(() => {
    setScanCol(col);
    col++;
    if (col >= GRID_COLS) {
      col = 0;
      sweepIndex++;
      if (sweepIndex >= 3) {
        clearInterval(interval);
        setScanCol(null);
      }
    }
  }, SWEEP_MS);
  timersRef.current.push(interval as unknown as ReturnType<typeof setTimeout>);
}, 1800);
```

- [ ] **Step 2: Modify grid cell rendering to react to `scanCol`**

Change cell rendering to apply a brighten fill when the current or previous column is active:

```tsx
{gridRevealed && Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, i) => {
  const col = i % GRID_COLS;
  const row = Math.floor(i / GRID_COLS);
  const cx = GRID_ORIGIN_X + col * (GRID_CELL_W + GRID_GAP);
  const cy = GRID_ORIGIN_Y + row * (GRID_CELL_H + GRID_GAP);
  const delay = (col + row) * 20;

  // Brighten based on distance from scan column (falloff)
  let fill = '#e4e0f0';
  if (scanCol !== null) {
    const dist = Math.abs(col - scanCol);
    if (dist === 0) fill = '#8b5cf6';
    else if (dist === 1) fill = '#b8a4f0';
    else if (dist === 2) fill = '#d4c7f5';
  }

  return (
    <rect key={`cell-${i}`} x={cx} y={cy} width={GRID_CELL_W} height={GRID_CELL_H}
          rx={1.5} fill={fill}
          className="cell-reveal"
          style={{ animationDelay: `${delay}ms`, transition: 'fill 0.12s' }} />
  );
})}
```

- [ ] **Step 3: Verify**

Reload. During t=1.8s to ~4.2s, a soft purple wavefront should sweep left-to-right across the grid three times. Cells brighten as the wavefront passes and fade back.

- [ ] **Step 4: Commit**

```bash
git add demo/src/slides/Phase1Slide.tsx
git commit -m "feat(slide2): column-by-column scan sweep"
```

---

## Task 8: Thought stream + cost meter typewriter

**Files:**
- Modify: `demo/src/slides/Phase1Slide.tsx`

Add the right-pane typewriter effect and ticker values. Four lines, one every ~500ms, older lines fade upward.

- [ ] **Step 1: Add state**

```tsx
const [thoughtLines, setThoughtLines] = useState<string[]>([]);
const [tokenCount, setTokenCount] = useState(0);
const [cost, setCost] = useState(0);

const ALL_THOUGHTS = [
  '> parsing intent…',
  '> matching: order ops…',
  '> candidates: 7 → 3',
  '> plan: get · cancel · refund',
];
```

- [ ] **Step 2: Schedule thought reveals and cost tick**

Inside the timeline `useEffect`, after scan starts (1800ms):

```tsx
// Thought stream: one line every 500ms starting at t=1.9s
ALL_THOUGHTS.forEach((line, idx) => {
  schedule(() => {
    setThoughtLines(prev => [...prev, line].slice(-4));
  }, 1900 + idx * 550);
});

// Cost/token ticker: ramp from 0 to 842 tokens and $0.000 to $0.021 over 1.8s-4.3s
schedule(() => {
  const startT = performance.now();
  const duration = 2500;
  const tick = () => {
    const elapsed = performance.now() - startT;
    const t = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - t, 2); // ease-out
    setTokenCount(Math.round(eased * 842));
    setCost(eased * 0.021);
    if (t < 1) {
      const raf = requestAnimationFrame(tick);
      // We cannot cancel RAF via our timer array; safe here because this runs at most once per activation
    }
  };
  requestAnimationFrame(tick);
}, 1800);
```

- [ ] **Step 3: Replace the thought-stream placeholder with live lines and update cost labels**

```tsx
{/* Right pane: thought stream */}
<text x={LLM_THOUGHT_PANE.x} y={LLM_THOUGHT_PANE.y + 8}
      fontSize={10} fontFamily="'Geist Mono', monospace" fill="#888" letterSpacing={1}>
  THOUGHT STREAM
</text>
{thoughtLines.map((line, idx) => {
  const age = thoughtLines.length - 1 - idx;
  const opacity = Math.max(0.2, 1 - age * 0.2);
  return (
    <text key={`thought-${idx}`}
          x={LLM_THOUGHT_PANE.x} y={LLM_THOUGHT_PANE.y + 32 + idx * 22}
          fontSize={12} fontFamily="'Geist Mono', monospace" fill="#444"
          opacity={opacity}>
      {line}
      {idx === thoughtLines.length - 1 && (
        <tspan className="caret" fill="#8b5cf6">▋</tspan>
      )}
    </text>
  );
})}

{/* Bottom cost strip */}
<line x1={LLM_COST_STRIP.x} y1={LLM_COST_STRIP.y - 6}
      x2={LLM_COST_STRIP.x + LLM_COST_STRIP.w} y2={LLM_COST_STRIP.y - 6}
      stroke="#e0d8f0" strokeWidth={1} />
<text x={LLM_COST_STRIP.x} y={LLM_COST_STRIP.y + 4}
      fontSize={10} fontFamily="'Geist Mono', monospace" fill="#666">
  {`TOKENS ${tokenCount}`}
</text>
<text x={LLM_COST_STRIP.x + LLM_COST_STRIP.w} y={LLM_COST_STRIP.y + 4}
      fontSize={10} fontFamily="'Geist Mono', monospace" fill="#666" textAnchor="end">
  {`$${cost.toFixed(3)}`}
</text>
```

- [ ] **Step 4: Reset thought state on deactivation**

In the `if (!active)` cleanup branch of the effect, also call: `setThoughtLines([]); setTokenCount(0); setCost(0);`

- [ ] **Step 5: Verify**

Reload. During t=1.9s to ~4s:
- Four mono thought lines appear in the right pane, one every 500ms, with a blinking caret on the latest
- Older lines fade to lower opacity as newer ones appear
- `TOKENS` counter climbs from 0 to 842 smoothly
- Cost climbs from `$0.000` to `$0.021` in sync

- [ ] **Step 6: Commit**

```bash
git add demo/src/slides/Phase1Slide.tsx
git commit -m "feat(slide2): thought stream + token/cost ticker"
```

---

## Task 9: Crystallize — three cells catch

**Files:**
- Modify: `demo/src/slides/Phase1Slide.tsx`

At t=4.3s, three specific cells stay selected (black) while the rest stop sweeping. LLM status dot turns green. This is the first half of the hero beat.

- [ ] **Step 1: Add state**

```tsx
const [selectedCells, setSelectedCells] = useState<Set<number>>(new Set());
```

- [ ] **Step 2: Schedule at t=4.3s**

```tsx
schedule(() => {
  setSelectedCells(new Set(SELECTED_CELLS));
  setLlmBreathing(false);
  setPhase('llm-selected');
  onNarrate('3 tools selected. Executing plan...');
}, 4300);
```

- [ ] **Step 3: Update cell rendering to honor selection**

Change the cell fill logic:

```tsx
const isSelected = selectedCells.has(i);
let fill = '#e4e0f0';
if (isSelected) {
  fill = '#1a1a1a';
} else if (scanCol !== null) {
  const dist = Math.abs(col - scanCol);
  if (dist === 0) fill = '#8b5cf6';
  else if (dist === 1) fill = '#b8a4f0';
  else if (dist === 2) fill = '#d4c7f5';
}

return (
  <rect key={`cell-${i}`} x={cx} y={cy} width={GRID_CELL_W} height={GRID_CELL_H}
        rx={1.5} fill={fill}
        className={`cell-reveal${isSelected ? ' cell-catch' : ''}`}
        style={{ animationDelay: `${delay}ms`, transition: isSelected ? 'none' : 'fill 0.12s' }} />
);
```

- [ ] **Step 4: Reset selection in cleanup**

In `if (!active)`: `setSelectedCells(new Set());`

- [ ] **Step 5: Verify**

Reload. At t=4.3s: scanning stops, three specific cells (indices 19, 54, 87) snap to solid black with a scale bump, and the LLM header dot turns green with a checkmark appearing.

- [ ] **Step 6: Commit**

```bash
git add demo/src/slides/Phase1Slide.tsx
git commit -m "feat(slide2): three cells catch on final sweep"
```

---

## Task 10: Detach animation — cells fly down and become tool cards

**Files:**
- Modify: `demo/src/slides/Phase1Slide.tsx`

The hero beat. At t=4.6s the three selected cells animate to the tool-card slots via CSS transform, simultaneously the real tool cards fade in at t=5.0s (after the detach lands) and the detaching cells fade out. Implementation uses an overlay `<g>` positioned absolutely over the grid cells, which translates and scales in place.

- [ ] **Step 1: Add state**

```tsx
const [detaching, setDetaching] = useState(false);
const [toolsVisible, setToolsVisible] = useState(false);
```

- [ ] **Step 2: Schedule**

```tsx
// t=4.6s — detach
schedule(() => setDetaching(true), 4600);
// t=5.2s — tool cards visible (detach finishes at 5.2s)
schedule(() => {
  setToolsVisible(true);
  setPhase('tools-executing');
}, 5200);
```

- [ ] **Step 3: Render the detach overlay**

Add a function `computeDetachTransform(cellIdx, toolIdx)` above the component:

```tsx
function cellPos(i: number) {
  const col = i % GRID_COLS;
  const row = Math.floor(i / GRID_COLS);
  return {
    x: GRID_ORIGIN_X + col * (GRID_CELL_W + GRID_GAP),
    y: GRID_ORIGIN_Y + row * (GRID_CELL_H + GRID_GAP),
  };
}

function detachTransform(cellIdx: number, toolIdx: number): string {
  const from = cellPos(cellIdx);
  const to = { x: TOOLS[toolIdx].x, y: TOOL_Y };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const sx = TOOL_W / GRID_CELL_W;
  const sy = TOOL_H / GRID_CELL_H;
  // Translate first, then scale around the cell's original top-left
  return `translate(${dx}, ${dy}) scale(${sx}, ${sy})`;
}
```

Add the detach overlay *after* the grid cells in the LLM `<g>`:

```tsx
{detaching && SELECTED_CELLS.map((cellIdx, toolIdx) => {
  const { x, y } = cellPos(cellIdx);
  return (
    <rect key={`detach-${cellIdx}`}
          x={x} y={y} width={GRID_CELL_W} height={GRID_CELL_H}
          rx={1.5} fill="#1a1a1a"
          style={{
            transformBox: 'fill-box',
            transformOrigin: '0 0',
            transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: detachTransform(cellIdx, toolIdx),
          }} />
  );
})}
```

And hide the original selected cells once `detaching` begins (to avoid duplication):

```tsx
// In the cell rendering loop, skip selected cells once detaching:
if (detaching && isSelected) return null;
```

- [ ] **Step 4: Make tool cards appear only when `toolsVisible`**

Change the tool-cards wrapping `<g>` opacity to `toolsVisible ? 1 : 0` with a `transition: 'opacity 0.25s'`. The detach rects land at the same coordinates as tool cards, so the crossfade should feel seamless.

- [ ] **Step 5: Hide detach rects after tool cards appear (to allow real cards to take over)**

Replace the detaching overlay rendering with a version that fades out at t=5.2s:

```tsx
{detaching && SELECTED_CELLS.map((cellIdx, toolIdx) => {
  const { x, y } = cellPos(cellIdx);
  return (
    <rect key={`detach-${cellIdx}`}
          x={x} y={y} width={GRID_CELL_W} height={GRID_CELL_H}
          rx={1.5} fill="#1a1a1a"
          style={{
            transformBox: 'fill-box',
            transformOrigin: '0 0',
            transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s 0.55s',
            transform: detachTransform(cellIdx, toolIdx),
            opacity: toolsVisible ? 0 : 1,
          }} />
  );
})}
```

- [ ] **Step 6: Verify**

Reload. At t=4.6s, the three black cells should smoothly fly down from their grid positions and scale up to the full tool-card size (600ms, ease-out). At ~5.2s, the real dark tool cards appear with header strips, and the flying rects disappear. Visually, the cells *become* the cards — no jarring cut.

- [ ] **Step 7: Commit**

```bash
git add demo/src/slides/Phase1Slide.tsx
git commit -m "feat(slide2): crystallize-and-detach hero animation"
```

---

## Task 11: Tool card output lines (terminal streaming)

**Files:**
- Modify: `demo/src/slides/Phase1Slide.tsx`

Each tool card's output line typewriters in, staggered by 150ms. Amber tick in top-left completes the tool variant's signature.

- [ ] **Step 1: Add state**

```tsx
const [toolOutputs, setToolOutputs] = useState<Record<string, string>>({});
const [toolDone, setToolDone] = useState<Set<string>>(new Set());
```

- [ ] **Step 2: Schedule output streaming**

After `setToolsVisible(true)` at 5200ms, schedule per-tool typewriter:

```tsx
TOOLS.forEach((tool, idx) => {
  const startAt = 5200 + idx * 150;
  // Reveal output char-by-char over 350ms
  const full = tool.output;
  const perChar = Math.max(10, Math.floor(350 / full.length));
  for (let c = 1; c <= full.length; c++) {
    schedule(() => {
      setToolOutputs(prev => ({ ...prev, [tool.id]: full.slice(0, c) }));
    }, startAt + c * perChar);
  }
  // Mark done 100ms after full text lands
  schedule(() => {
    setToolDone(prev => new Set(prev).add(tool.id));
  }, startAt + full.length * perChar + 120);
});
```

- [ ] **Step 3: Update tool card rendering**

In the tool-cards `<g>`:

```tsx
{TOOLS.map(t => {
  const isDone = toolDone.has(t.id);
  const isActive = toolsVisible && !isDone;
  const output = toolOutputs[t.id] || '';
  return (
    <g key={t.id}>
      <rect x={t.x} y={TOOL_Y} width={TOOL_W} height={TOOL_H}
            rx={4} fill="#282835" stroke="#3a3a48" strokeWidth={1} />
      {/* Amber tick signature */}
      <rect x={t.x + 2} y={TOOL_Y + HEADER_H + 2} width={3} height={8} fill="#f59e0b" />
      <BoxHeader x={t.x} y={TOOL_Y} w={TOOL_W} rx={4}
                 label={t.label}
                 status={isDone ? 'done' : isActive ? 'active' : 'idle'}
                 showCheck={isDone} />
      <text x={t.x + 10} y={TOOL_Y + HEADER_H + 30}
            fontSize={11} fontFamily="'Geist Mono', monospace" fill="#b8b8c8">
        {output}
        {isActive && output.length > 0 && output.length < t.output.length && (
          <tspan className="caret" fill="#f59e0b">▋</tspan>
        )}
      </text>
    </g>
  );
})}
```

- [ ] **Step 4: Reset on deactivate**

`setToolOutputs({}); setToolDone(new Set());`

- [ ] **Step 5: Verify**

Reload. From t=5.2s the three tool cards show their output lines typewritering in one after another, each card's status dot turns green when its output finishes. The amber tick is visible in the top-left corner of each card's body.

- [ ] **Step 6: Commit**

```bash
git add demo/src/slides/Phase1Slide.tsx
git commit -m "feat(slide2): tool card output streaming"
```

---

## Task 12: Edges — customer→LLM, LLM→tools, tools→response

**Files:**
- Modify: `demo/src/slides/Phase1Slide.tsx`

Add the three sets of connecting paths, with stroke-dash draw-in animation.

- [ ] **Step 1: Add state**

```tsx
const [visibleEdges, setVisibleEdges] = useState<Set<string>>(new Set());
```

- [ ] **Step 2: Add path definitions and helper**

```tsx
function curve(x1: number, y1: number, x2: number, y2: number): string {
  const cy1 = y1 + (y2 - y1) * 0.4;
  const cy2 = y1 + (y2 - y1) * 0.6;
  return `M${x1},${y1} C${x1},${cy1} ${x2},${cy2} ${x2},${y2}`;
}

const EDGES = [
  { id: 'customer-llm', d: curve(CUSTOMER.x + CUSTOMER.w / 2, CUSTOMER.y + CUSTOMER.h, LLM.x + LLM.w / 2, LLM.y) },
  ...TOOLS.map((t) => ({
    id: `tool-${t.id}-response`,
    d: curve(t.x + TOOL_W / 2, TOOL_Y + TOOL_H, RESPONSE.x + RESPONSE.w / 2, RESPONSE.y),
  })),
];
```

- [ ] **Step 3: Schedule edge reveals**

```tsx
// t=0.6s — customer→LLM
schedule(() => setVisibleEdges(prev => new Set(prev).add('customer-llm')), 600);

// t=6.0s — tools→response (all three together)
schedule(() => {
  setVisibleEdges(prev => {
    const next = new Set(prev);
    TOOLS.forEach(t => next.add(`tool-${t.id}-response`));
    return next;
  });
}, 6000);
```

- [ ] **Step 4: Render edges before nodes in the SVG**

At the top of the `<svg>`:

```tsx
{EDGES.map(e => (
  <path key={e.id} d={e.d}
        className={`svg-edge${visibleEdges.has(e.id) ? ' visible' : ''}`}
        stroke="#ccc" strokeWidth={1.5} fill="none" />
))}
```

- [ ] **Step 5: Reset on deactivate**

`setVisibleEdges(new Set());`

- [ ] **Step 6: Verify**

Reload. Customer→LLM edge draws in at t=0.6s (top to bottom). Tools→response edges draw in at t=6.0s. No edge between LLM and tools (the detach animation IS that connection, visually).

- [ ] **Step 7: Commit**

```bash
git add demo/src/slides/Phase1Slide.tsx
git commit -m "feat(slide2): edges with stroke-draw animation"
```

---

## Task 13: Response receipt card

**Files:**
- Modify: `demo/src/slides/Phase1Slide.tsx`

Build the structured receipt body with row-by-row reveal and the green seal wipe.

- [ ] **Step 1: Add state**

```tsx
const [responseVisible, setResponseVisible] = useState(false);
const [receiptRows, setReceiptRows] = useState<number>(0); // 0..3
const [sealVisible, setSealVisible] = useState(false);
```

- [ ] **Step 2: Schedule**

```tsx
// t=6.4s — response box appears
schedule(() => {
  setResponseVisible(true);
  onNarrate('Response generated. 4.2s, $0.021 per request');
}, 6400);

// t=6.5s, 6.62s, 6.74s — receipt rows reveal
schedule(() => setReceiptRows(1), 6500);
schedule(() => setReceiptRows(2), 6620);
schedule(() => setReceiptRows(3), 6740);

// t=6.9s — seal wipes
schedule(() => {
  setSealVisible(true);
  setPhase('done');
}, 6900);
```

- [ ] **Step 3: Render the receipt**

Replace the response box section:

```tsx
<g style={{ opacity: responseVisible ? 1 : 0, transition: 'opacity 0.3s ease-out' }}>
  <rect x={RESPONSE.x} y={RESPONSE.y} width={RESPONSE.w} height={RESPONSE.h}
        rx={8} fill="#effdf4" stroke="#86efac" strokeWidth={1} />
  <BoxHeader x={RESPONSE.x} y={RESPONSE.y} w={RESPONSE.w} rx={8}
             label="RESPONSE" status={phase === 'done' ? 'done' : 'idle'}
             showCheck={phase === 'done'} />

  {/* Receipt rows */}
  {[
    { label: 'time', value: '4.2s' },
    { label: 'cost', value: '$0.021' },
    { label: 'status', value: '✓ complete' },
  ].map((row, idx) => {
    const rowY = RESPONSE.y + HEADER_H + 14 + idx * 18;
    return receiptRows > idx ? (
      <g key={row.label} className="row-reveal">
        <text x={RESPONSE.x + 16} y={rowY} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill="#888">
          {row.label}
        </text>
        <text x={RESPONSE.x + RESPONSE.w - 16} y={rowY} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill="#166534"
              textAnchor="end">
          {row.value}
        </text>
        {idx < 2 && (
          <line x1={RESPONSE.x + 16} y1={rowY + 5}
                x2={RESPONSE.x + RESPONSE.w - 16} y2={rowY + 5}
                stroke="#d0ead8" strokeWidth={0.5} />
        )}
      </g>
    ) : null;
  })}

  {/* Green seal bar */}
  {sealVisible && (
    <rect x={RESPONSE.x + 2} y={RESPONSE.y + RESPONSE.h - 5}
          width={RESPONSE.w - 4} height={4} rx={2} fill="#22c55e"
          className="seal-wipe" />
  )}
</g>
```

- [ ] **Step 4: Reset on deactivate**

`setResponseVisible(false); setReceiptRows(0); setSealVisible(false);`

- [ ] **Step 5: Verify**

Reload. At t=6.4s the response box fades in. Three receipt rows (`time 4.2s`, `cost $0.021`, `status ✓ complete`) appear sequentially with subtle dividers. At t=6.9s the green bottom bar wipes in from left to right. Response box header shows green dot + checkmark.

- [ ] **Step 6: Commit**

```bash
git add demo/src/slides/Phase1Slide.tsx
git commit -m "feat(slide2): response receipt with row reveal and seal wipe"
```

---

## Task 14: Full timeline review + manual QA

**Files:** none (verification only)

- [ ] **Step 1: Full playthrough**

Run `npm run dev` and navigate to slide 2. Watch the full ~8s sequence from idle. Confirm each beat from the spec:

- 0.0s customer appears
- 0.6s edge draws to LLM
- 1.0s LLM materializes, breathing border, status dot amber
- 1.3s grid cascades in diagonally
- 1.8s scan sweep begins; thought tokens start typewritering in; token/cost tickers climb
- 4.3s three cells catch; LLM status dot green
- 4.6s three cells fly down, scale up — the hero beat
- 5.2s tool cards finalize; output lines start typewritering staggered
- ~5.8s all tool cards show `done` status
- 6.0s three edges draw from tools to response
- 6.4s response box appears
- 6.5s/6.6s/6.7s receipt rows reveal
- 6.9s green seal bar wipes

- [ ] **Step 2: Navigate away and back**

Press left arrow to go to slide 1, then right arrow to return to slide 2. Confirm the animation restarts cleanly every time (no leftover state, no duplicate cells, no stuck timers).

- [ ] **Step 3: Check narration banner**

Confirm the narration banner at the top updates at 0.0s, 1.3s, 4.3s, and 6.4s with the correct text.

- [ ] **Step 4: Browser console clean**

Open DevTools. No warnings, no errors, no React key warnings during the animation.

- [ ] **Step 5: If any issues found, fix inline and commit separately**

```bash
git add <files>
git commit -m "fix(slide2): <specific issue>"
```

- [ ] **Step 6: Final commit if no fixes needed**

If nothing to fix, there's nothing to commit — proceed.

---

## Notes for the implementer

- **SVG transform gotcha**: `transform-box: fill-box` on `<rect>` is required for transforms to originate from the element itself rather than the SVG root. The CSS keyframes already set this where needed; inline-style transforms in Task 10 set it via React style prop.
- **Cleanup discipline**: every new state setter in the effect's `if (!active)` branch must be reset. Navigating away and back should restart cleanly every time.
- **Timer leakage**: always push schedule IDs into `timersRef`, and clear them in the cleanup. The existing `schedule` helper does this; use it for every `setTimeout`. The `setInterval` in Task 7 is cast and pushed — that works for clearing because `clearTimeout` can clear intervals too in browsers, but prefer using `clearInterval` if refactoring.
- **Performance**: the grid has 128 cells, thought stream updates ~2× per second, tickers update at animation-frame rate. This is well within React 19's capacity for SVG — no need for memoization unless you observe jank.
- **Never use `NODE_STYLES`** from `nodeStyles.ts` in this slide. The new design intentionally does not share that abstraction — inlining treatments is clearer for a one-off hero slide.
