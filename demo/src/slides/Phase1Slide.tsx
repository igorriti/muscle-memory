import { useEffect, useRef, useState, useCallback } from 'react';
import { TOOL_NAMES as BENCH_TOOL_NAMES, getToolsForPattern, makeQuery, BENCHMARK_STATS } from '../benchmarkData';

interface SlideProps {
  active: boolean;
  onComplete: () => void;
  onNarrate: (text: string) => void;
}

type Phase = 'idle' | 'customer' | 'llm-scanning' | 'llm-selected' | 'tools-executing' | 'response' | 'done';

// Layout constants (SVG coordinates, viewBox 0 0 960 680)
const CUSTOMER = { x: 350, y: 20, w: 260, h: 90 };
const LLM = { x: 140, y: 140, w: 680, h: 250 };
const LLM_GRID_PANE = { x: LLM.x + 20, y: LLM.y + 50, w: 320, h: 170 };
const LLM_THOUGHT_PANE = { x: LLM.x + 360, y: LLM.y + 50, w: 300, h: 140 };
const LLM_COST_STRIP = { x: LLM.x + 360, y: LLM.y + 200, w: 300, h: 20 };

const TOOL_Y = 430;
const TOOL_H = 90;
const TOOL_W = 210;
// Tool chain for the cancel_order pattern comes from the benchmark.
const CANCEL_TOOL_CHAIN = getToolsForPattern('cancel_order');
const TOOL_OUTPUTS: Record<string, string> = {
  get_order:      '→ $89.99, processing',
  cancel_order:   '→ cancelled ✓',
  refund_payment: '→ refund $89.99 queued',
};
const TOOL_X = [135, 375, 615];
const TOOLS = CANCEL_TOOL_CHAIN.map((id, i) => ({
  id,
  label: id.toUpperCase(),
  x: TOOL_X[i],
  output: TOOL_OUTPUTS[id] ?? '→ done',
}));
// Demo query sampled from QUERY_PATTERNS.cancel_order.
const DEMO_QUERY = makeQuery('cancel_order', 410); // template 0, id=1410
// Per-query averages derived from the benchmark run.
const AVG_TOKENS_PER_QUERY = Math.round(BENCHMARK_STATS.totalTokensWithout / BENCHMARK_STATS.totalQueries);
const AVG_COST_PER_QUERY = BENCHMARK_STATS.totalCostWithout / BENCHMARK_STATS.totalQueries;
const AVG_LAT_SEC = (BENCHMARK_STATS.avgLatWithoutMs / 1000).toFixed(1);
const AVG_COST_STR = `$${AVG_COST_PER_QUERY.toFixed(3)}`;

const RESPONSE = { x: 350, y: 550, w: 260, h: 100 };

// Tool grid (inside LLM_GRID_PANE)
const GRID_COLS = 16;
const GRID_ROWS = 8;
const GRID_CELL_W = 15;
const GRID_CELL_H = 12;
const GRID_GAP = 3;
const GRID_ORIGIN_X = LLM_GRID_PANE.x + (LLM_GRID_PANE.w - (GRID_COLS * (GRID_CELL_W + GRID_GAP) - GRID_GAP)) / 2;
const GRID_ORIGIN_Y = LLM_GRID_PANE.y + 20;
const SELECTED_CELLS = [18, 56, 109]; // which cells become tools

// Grid tooltips pull from the real 128-tool benchmark catalog.
const TOOL_NAMES = BENCH_TOOL_NAMES.slice(0, GRID_COLS * GRID_ROWS);
// Override selected cells with the cancel_order chain so the "caught" cells
// match the tool cards rendered below.
SELECTED_CELLS.forEach((idx, i) => { TOOL_NAMES[idx] = CANCEL_TOOL_CHAIN[i]; });

function cellPos(i: number) {
  const col = i % GRID_COLS;
  const row = Math.floor(i / GRID_COLS);
  return {
    x: GRID_ORIGIN_X + col * (GRID_CELL_W + GRID_GAP),
    y: GRID_ORIGIN_Y + row * (GRID_CELL_H + GRID_GAP),
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function detachRectAttrs(cellIdx: number, toolIdx: number, progress: number) {
  const from = cellPos(cellIdx);
  const eased = easeInOutCubic(progress);
  return {
    x: lerp(from.x, TOOLS[toolIdx].x, eased),
    y: lerp(from.y, TOOL_Y, eased),
    width: lerp(GRID_CELL_W, TOOL_W, eased),
    height: lerp(GRID_CELL_H, TOOL_H, eased),
    rx: lerp(1.5, 8, eased),
  };
}

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

const HEADER_H = 32;
const SURFACE_FILL = '#fff';
const SURFACE_STROKE = '#d4d4d4';
const LLM_FILL = '#fafafa';
const LABEL_COLOR = '#666';
const DIVIDER_COLOR = '#e5e5e5';

const ALL_THOUGHTS = [
  '> parsing intent…',
  '> matching: order ops…',
  '> candidates: 7 → 3',
  '> plan: get · cancel · refund',
];

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

function BoxHeader({ x, y, w, label, status, showCheck }: BoxHeaderProps) {
  return (
    <g>
      <circle cx={x + 14} cy={y + HEADER_H / 2} r={3.5}
              fill={statusColor(status)}
              className={status === 'active' ? 'status-pulse' : ''} />
      <text x={x + 26} y={y + HEADER_H / 2 + 1} fontSize={10}
            fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}
            letterSpacing={0.8} dominantBaseline="middle">
        {label}
      </text>
      {showCheck && (
        <text x={x + w - 14} y={y + HEADER_H / 2 + 1} fontSize={11}
              fill="#22c55e" fontFamily="'Geist Mono', monospace"
              textAnchor="end" dominantBaseline="middle">
          &#10003;
        </text>
      )}
      <line x1={x + 14} y1={y + HEADER_H} x2={x + w - 14} y2={y + HEADER_H}
            stroke={DIVIDER_COLOR} strokeWidth={1} />
    </g>
  );
}

export function Phase1Slide({ active, onComplete, onNarrate }: SlideProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [visibleBoxes, setVisibleBoxes] = useState<Set<string>>(new Set());
  const [gridRevealed, setGridRevealed] = useState(false);
  const [llmBreathing, setLlmBreathing] = useState(false);
  const [scanCol, setScanCol] = useState<number | null>(null);
  const [thoughtLines, setThoughtLines] = useState<string[]>([]);
  const [tokenCount, setTokenCount] = useState(0);
  const [cost, setCost] = useState(0);
  const [selectedCells, setSelectedCells] = useState<Set<number>>(new Set());
  const [detaching, setDetaching] = useState(false);
  const [detachProgress, setDetachProgress] = useState(0);
  const [toolsVisible, setToolsVisible] = useState(false);
  const [toolOutputs, setToolOutputs] = useState<Record<string, string>>({});
  const [toolDone, setToolDone] = useState<Set<string>>(new Set());
  const [visibleEdges, setVisibleEdges] = useState<Set<string>>(new Set());
  const [responseVisible, setResponseVisible] = useState(false);
  const [receiptRows, setReceiptRows] = useState<number>(0);
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
  }, []);


  useEffect(() => {
    if (!active) {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      setPhase('idle');
      setVisibleBoxes(new Set());
      setGridRevealed(false);
      setLlmBreathing(false);
      setScanCol(null);
      setThoughtLines([]);
      setTokenCount(0);
      setCost(0);
      setSelectedCells(new Set());
      setDetaching(false);
      setDetachProgress(0);
      setToolsVisible(false);
      setToolOutputs({});
      setToolDone(new Set());
      setVisibleEdges(new Set());
      setResponseVisible(false);
      setReceiptRows(0);
      setHoveredCell(null);
      return;
    }

    // t=0.0s — customer
    schedule(() => {
      setVisibleBoxes(prev => new Set(prev).add('customer'));
      onNarrate(`Request received: ${DEMO_QUERY}`);
      setPhase('customer');
    }, 0);

    // t=0.6s — customer→LLM edge
    schedule(() => setVisibleEdges(prev => new Set(prev).add('customer-llm')), 600);

    // t=1.0s — LLM materializes
    schedule(() => {
      setVisibleBoxes(prev => new Set(prev).add('llm'));
      setLlmBreathing(true);
      setPhase('llm-scanning');
    }, 1000);

    // t=1.3s — grid cascade
    schedule(() => {
      setGridRevealed(true);
      onNarrate(`LLM scanning ${BENCHMARK_STATS.toolCount} tools...`);
    }, 1300);

    // t=1.8s — start scan sweeps (3 full sweeps over ~2.5s)
    schedule(() => {
      let sweepIndex = 0;
      let col = 0;
      const SWEEP_MS = 50; // per column
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

    // Thought stream: one line every 500ms starting at t=1.9s
    ALL_THOUGHTS.forEach((line, idx) => {
      schedule(() => {
        setThoughtLines(prev => [...prev, line].slice(-4));
      }, 1900 + idx * 550);
    });

    // Cost/token ticker: per-query averages from BENCHMARK_STATS.
    schedule(() => {
      const startT = performance.now();
      const duration = 2500;
      const tick = () => {
        const elapsed = performance.now() - startT;
        const t = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - t, 2); // ease-out
        setTokenCount(Math.round(eased * AVG_TOKENS_PER_QUERY));
        setCost(eased * AVG_COST_PER_QUERY);
        if (t < 1) {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    }, 1800);

    // t=4.3s — three cells catch
    schedule(() => {
      setSelectedCells(new Set(SELECTED_CELLS));
      setLlmBreathing(false);
      setPhase('llm-selected');
      onNarrate('3 tools selected. Executing plan...');
    }, 4300);

    // t=4.6s — detach: RAF-driven animation of x/y/w/h directly
    schedule(() => {
      setDetaching(true);
      const duration = 950;
      const startT = performance.now();
      const tick = () => {
        const elapsed = performance.now() - startT;
        const t = Math.min(elapsed / duration, 1);
        setDetachProgress(t);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, 4600);

    // t=5.55s — tool cards visible (after 950ms detach travel), detach rects fade out
    schedule(() => {
      setToolsVisible(true);
      setPhase('tools-executing');
    }, 5550);

    // Per-tool output streams starting at 5550 + idx*150
    TOOLS.forEach((tool, idx) => {
      const startAt = 5550 + idx * 150;
      const full = tool.output;
      const perChar = Math.max(10, Math.floor(350 / full.length));
      for (let c = 1; c <= full.length; c++) {
        schedule(() => {
          setToolOutputs(prev => ({ ...prev, [tool.id]: full.slice(0, c) }));
        }, startAt + c * perChar);
      }
      // Mark done 120ms after full text lands
      schedule(() => {
        setToolDone(prev => new Set(prev).add(tool.id));
      }, startAt + full.length * perChar + 120);
    });

    // tools→response edges
    schedule(() => {
      setVisibleEdges(prev => {
        const next = new Set(prev);
        TOOLS.forEach(t => next.add(`tool-${t.id}-response`));
        return next;
      });
    }, 6350);

    // response appears
    schedule(() => {
      setResponseVisible(true);
      onNarrate(`Response generated. ${AVG_LAT_SEC}s, ${AVG_COST_STR} per request`);
    }, 6750);

    // receipt rows reveal
    schedule(() => setReceiptRows(1), 6850);
    schedule(() => setReceiptRows(2), 6970);
    schedule(() => setReceiptRows(3), 7090);

    // phase done
    schedule(() => {
      setPhase('done');
    }, 7250);

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [active]);

  return (
    <div className="slide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={1248} height={884} viewBox="0 0 960 680">
        {EDGES.map(e => (
          <path key={e.id} d={e.d}
                className={`svg-edge${visibleEdges.has(e.id) ? ' visible' : ''}`}
                stroke="#ccc" strokeWidth={1.5} fill="none" />
        ))}

        {/* Customer message placeholder */}
        <g className={phase === 'done' ? 'card-interactive' : undefined}
           style={{ opacity: visibleBoxes.has('customer') ? 1 : 0, transition: 'opacity 0.3s ease-out' }}>
          <rect x={CUSTOMER.x} y={CUSTOMER.y} width={CUSTOMER.w} height={CUSTOMER.h}
                rx={8} fill={SURFACE_FILL} stroke={SURFACE_STROKE} strokeWidth={1} />
          {/* Customer body */}
          <text x={CUSTOMER.x + 14} y={CUSTOMER.y + HEADER_H + 22} fontSize={36}
                fontFamily="Georgia, serif" fill="#ddd">
            &ldquo;
          </text>
          <text x={CUSTOMER.x + CUSTOMER.w / 2} y={CUSTOMER.y + HEADER_H + (CUSTOMER.h - HEADER_H) / 2 + 4}
                fontSize={14} fontFamily="'Geist', sans-serif" fill="#1a1a1a"
                fontStyle="italic" textAnchor="middle" dominantBaseline="middle">
            {DEMO_QUERY}
          </text>
          <BoxHeader x={CUSTOMER.x} y={CUSTOMER.y} w={CUSTOMER.w} rx={8}
                     label="CUSTOMER MESSAGE" status={phase === 'idle' ? 'idle' : 'done'} showCheck={phase !== 'idle'} />
        </g>

        {/* LLM workspace placeholder */}
        <g className={phase === 'done' ? 'card-interactive' : undefined}
           style={{ opacity: visibleBoxes.has('llm') ? 1 : 0, transition: 'opacity 0.3s ease-out' }}>
          <rect x={LLM.x} y={LLM.y} width={LLM.w} height={LLM.h}
                rx={8} fill={LLM_FILL} stroke={SURFACE_STROKE} strokeWidth={1} />
          {/* Pane divider */}
          <line x1={LLM.x + LLM.w / 2} y1={LLM.y + HEADER_H + 8}
                x2={LLM.x + LLM.w / 2} y2={LLM.y + LLM.h - 12}
                stroke={DIVIDER_COLOR} strokeWidth={1} />
          <BoxHeader x={LLM.x} y={LLM.y} w={LLM.w} rx={8}
                     label="LLM REASONING"
                     status={phase === 'llm-scanning' ? 'active' : phase === 'idle' || phase === 'customer' ? 'idle' : 'done'}
                     showCheck={phase === 'tools-executing' || phase === 'response' || phase === 'done'} />

          {/* Left pane: tool grid */}
          <text x={GRID_ORIGIN_X} y={LLM_GRID_PANE.y + 8}
                fontSize={10} fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}
                letterSpacing={0.8}>
            {`${BENCHMARK_STATS.toolCount} TOOLS`}
          </text>
          {gridRevealed && Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, i) => {
            const col = i % GRID_COLS;
            const row = Math.floor(i / GRID_COLS);
            const cx = GRID_ORIGIN_X + col * (GRID_CELL_W + GRID_GAP);
            const cy = GRID_ORIGIN_Y + row * (GRID_CELL_H + GRID_GAP);
            const delay = (col + row) * 20;

            const isSelected = selectedCells.has(i);
            if (detaching && isSelected) return null;
            let fill = '#d4d4d4';
            if (hoveredCell === i && !isSelected) {
              fill = '#1a1a1a';
            } else if (isSelected) {
              fill = '#1a1a1a';
            } else if (scanCol !== null) {
              const dist = Math.abs(col - scanCol);
              if (dist === 0) fill = '#8b5cf6';
              else if (dist === 1) fill = '#b79df0';
              else if (dist === 2) fill = '#d4c3ee';
            }

            return (
              <rect key={`cell-${i}`} x={cx} y={cy} width={GRID_CELL_W} height={GRID_CELL_H}
                    rx={1.5} fill={fill}
                    className={`cell-reveal grid-cell${isSelected ? ' cell-catch' : ''}`}
                    style={{ animationDelay: `${delay}ms`, transition: isSelected ? 'none' : 'fill 0.12s' }}
                    onMouseEnter={() => setHoveredCell(i)}
                    onMouseLeave={() => setHoveredCell(prev => (prev === i ? null : prev))} />
            );
          })}

          {detaching && SELECTED_CELLS.map((cellIdx, toolIdx) => {
            const attrs = detachRectAttrs(cellIdx, toolIdx, detachProgress);
            return (
              <rect key={`detach-${cellIdx}`}
                    x={attrs.x} y={attrs.y}
                    width={attrs.width} height={attrs.height}
                    rx={attrs.rx} fill="#1a1a1a"
                    style={{
                      transition: 'opacity 0.25s',
                      opacity: toolsVisible ? 0 : 1,
                    }} />
            );
          })}

          {/* Right pane: thought stream */}
          <text x={LLM_THOUGHT_PANE.x} y={LLM_THOUGHT_PANE.y + 8}
                fontSize={10} fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR} letterSpacing={0.8}>
            THOUGHT STREAM
          </text>
          {thoughtLines.map((line, idx) => {
            const age = thoughtLines.length - 1 - idx;
            const opacity = Math.max(0.35, 1 - age * 0.18);
            return (
              <text key={`thought-${idx}`}
                    x={LLM_THOUGHT_PANE.x} y={LLM_THOUGHT_PANE.y + 32 + idx * 22}
                    fontSize={12} fontFamily="'Geist Mono', monospace" fill="#1a1a1a"
                    opacity={opacity}>
                {line}
                {idx === thoughtLines.length - 1 && (
                  <tspan className="caret" fill="#8b5cf6">▋</tspan>
                )}
              </text>
            );
          })}

          {/* Bottom cost strip */}
          <text x={LLM_COST_STRIP.x} y={LLM_COST_STRIP.y + 4}
                fontSize={10} fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR} letterSpacing={0.8}>
            {`TOKENS ${tokenCount}`}
          </text>
          <text x={LLM_COST_STRIP.x + LLM_COST_STRIP.w} y={LLM_COST_STRIP.y + 4}
                fontSize={10} fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR} textAnchor="end" letterSpacing={0.8}>
            {`$${cost.toFixed(3)}`}
          </text>

          {/* Grid cell tooltip (B) */}
          {hoveredCell !== null && (() => {
            const pos = cellPos(hoveredCell);
            const name = TOOL_NAMES[hoveredCell];
            const cx = pos.x + GRID_CELL_W / 2;
            const tipW = Math.max(84, name.length * 6.2 + 16);
            const tipY = pos.y - 22;
            return (
              <g pointerEvents="none">
                <rect x={cx - tipW / 2} y={tipY} width={tipW} height={18} rx={4}
                      fill="#1a1a1a" />
                <text x={cx} y={tipY + 9} fontSize={10}
                      fontFamily="'Geist Mono', monospace" fill="#fff"
                      textAnchor="middle" dominantBaseline="middle">
                  {name}
                </text>
              </g>
            );
          })()}
        </g>

        {/* Tool card placeholders */}
        <g style={{ opacity: toolsVisible ? 1 : 0, transition: 'opacity 0.25s' }}>
          {TOOLS.map(t => {
            const isDone = toolDone.has(t.id);
            const isActive = toolsVisible && !isDone;
            const output = toolOutputs[t.id] || '';
            return (
              <g key={t.id} className={phase === 'done' ? 'card-interactive' : undefined}>
                <rect x={t.x} y={TOOL_Y} width={TOOL_W} height={TOOL_H}
                      rx={8} fill={SURFACE_FILL} stroke={SURFACE_STROKE} strokeWidth={1} />
                <BoxHeader x={t.x} y={TOOL_Y} w={TOOL_W} rx={8}
                           label={t.label}
                           status={isDone ? 'done' : isActive ? 'active' : 'idle'}
                           showCheck={isDone} />
                <text x={t.x + 14} y={TOOL_Y + HEADER_H + 26}
                      fontSize={12} fontFamily="'Geist Mono', monospace" fill="#1a1a1a">
                  {output}
                  {isActive && output.length > 0 && output.length < t.output.length && (
                    <tspan className="caret" fill="#8b5cf6">▋</tspan>
                  )}
                </text>
              </g>
            );
          })}
        </g>

        {/* Response with receipt rows */}
        <g className={phase === 'done' ? 'card-interactive' : undefined}
           style={{ opacity: responseVisible ? 1 : 0, transition: 'opacity 0.3s ease-out' }}>
          <rect x={RESPONSE.x} y={RESPONSE.y} width={RESPONSE.w} height={RESPONSE.h}
                rx={8} fill={SURFACE_FILL} stroke={SURFACE_STROKE} strokeWidth={1} />
          <BoxHeader x={RESPONSE.x} y={RESPONSE.y} w={RESPONSE.w} rx={8}
                     label="RESPONSE" status={phase === 'done' ? 'done' : 'idle'}
                     showCheck={phase === 'done'} />

          {/* Receipt rows */}
          {[
            { label: 'time', value: `${AVG_LAT_SEC}s`, color: '#1a1a1a', pulse: false },
            { label: 'cost', value: AVG_COST_STR, color: '#1a1a1a', pulse: false },
            { label: 'status', value: '✓ complete', color: '#22c55e', pulse: true },
          ].map((row, idx) => {
            const rowY = RESPONSE.y + HEADER_H + 16 + idx * 18;
            return receiptRows > idx ? (
              <g key={row.label} className="row-reveal">
                <text x={RESPONSE.x + 16} y={rowY} fontSize={11}
                      fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}>
                  {row.label}
                </text>
                <text x={RESPONSE.x + RESPONSE.w - 16} y={rowY} fontSize={11}
                      fontFamily="'Geist Mono', monospace" fill={row.color}
                      textAnchor="end"
                      className={row.pulse && phase === 'done' ? 'complete-pulse' : undefined}>
                  {row.value}
                </text>
                {idx < 2 && (
                  <line x1={RESPONSE.x + 16} y1={rowY + 6}
                        x2={RESPONSE.x + RESPONSE.w - 16} y2={rowY + 6}
                        stroke={DIVIDER_COLOR} strokeWidth={1} />
                )}
              </g>
            ) : null;
          })}
        </g>
      </svg>
    </div>
  );
}
