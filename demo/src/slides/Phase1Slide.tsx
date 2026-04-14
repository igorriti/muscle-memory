import { useEffect, useRef, useState, useCallback } from 'react';

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
  return `translate(${dx}, ${dy}) scale(${sx}, ${sy})`;
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

const HEADER_H = 28;
const HEADER_FILL = '#1a1a1a';

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
  const [detachEngaged, setDetachEngaged] = useState(false);
  const [toolsVisible, setToolsVisible] = useState(false);
  const [toolOutputs, setToolOutputs] = useState<Record<string, string>>({});
  const [toolDone, setToolDone] = useState<Set<string>>(new Set());
  const [visibleEdges, setVisibleEdges] = useState<Set<string>>(new Set());
  const [responseVisible, setResponseVisible] = useState(false);
  const [receiptRows, setReceiptRows] = useState<number>(0);
  const [sealVisible, setSealVisible] = useState(false);
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
      setDetachEngaged(false);
      setToolsVisible(false);
      setToolOutputs({});
      setToolDone(new Set());
      setVisibleEdges(new Set());
      setResponseVisible(false);
      setReceiptRows(0);
      setSealVisible(false);
      return;
    }

    // t=0.0s — customer
    schedule(() => {
      setVisibleBoxes(prev => new Set(prev).add('customer'));
      onNarrate('Request received: Cancel my order ORD-412');
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
      onNarrate('LLM scanning 128 tools...');
    }, 1300);

    // t=1.8s — start scan sweeps (3 full sweeps over ~2.5s)
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

    // Thought stream: one line every 500ms starting at t=1.9s
    ALL_THOUGHTS.forEach((line, idx) => {
      schedule(() => {
        setThoughtLines(prev => [...prev, line].slice(-4));
      }, 1900 + idx * 550);
    });

    // Cost/token ticker: ramp 0→842 tokens and $0→$0.021 over 2.5s starting at t=1.8s
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

    // t=4.6s — detach
    schedule(() => {
      setDetaching(true);
      // Next animation frame, engage the transform so CSS sees a state change
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setDetachEngaged(true));
      });
    }, 4600);

    // t=5.2s — tool cards visible, detach rects fade out
    schedule(() => {
      setToolsVisible(true);
      setPhase('tools-executing');
    }, 5200);

    // Per-tool output streams starting at 5200 + idx*150
    TOOLS.forEach((tool, idx) => {
      const startAt = 5200 + idx * 150;
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

    // t=6.0s — tools→response edges
    schedule(() => {
      setVisibleEdges(prev => {
        const next = new Set(prev);
        TOOLS.forEach(t => next.add(`tool-${t.id}-response`));
        return next;
      });
    }, 6000);

    // t=6.4s — response appears
    schedule(() => {
      setResponseVisible(true);
      onNarrate('Response generated. 4.2s, $0.021 per request');
    }, 6400);

    // t=6.5s / 6.62s / 6.74s — receipt rows reveal
    schedule(() => setReceiptRows(1), 6500);
    schedule(() => setReceiptRows(2), 6620);
    schedule(() => setReceiptRows(3), 6740);

    // t=6.9s — seal wipes + phase done
    schedule(() => {
      setSealVisible(true);
      setPhase('done');
    }, 6900);

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [active]);

  return (
    <div className="slide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={960} height={680} viewBox="0 0 960 680">
        {EDGES.map(e => (
          <path key={e.id} d={e.d}
                className={`svg-edge${visibleEdges.has(e.id) ? ' visible' : ''}`}
                stroke="#ccc" strokeWidth={1.5} fill="none" />
        ))}

        {/* Customer message placeholder */}
        <g style={{ opacity: visibleBoxes.has('customer') ? 1 : 0, transition: 'opacity 0.3s ease-out' }}>
          <rect x={CUSTOMER.x} y={CUSTOMER.y} width={CUSTOMER.w} height={CUSTOMER.h}
                rx={8} fill="#eff3ff" stroke="#c7d7fe" strokeWidth={1} />
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
          <BoxHeader x={CUSTOMER.x} y={CUSTOMER.y} w={CUSTOMER.w} rx={8}
                     label="CUSTOMER MESSAGE" status={phase === 'idle' ? 'idle' : 'done'} showCheck={phase !== 'idle'} />
        </g>

        {/* LLM workspace placeholder */}
        <g style={{ opacity: visibleBoxes.has('llm') ? 1 : 0, transition: 'opacity 0.3s ease-out' }}>
          <rect x={LLM.x} y={LLM.y} width={LLM.w} height={LLM.h}
                rx={8} fill="#f6f2ff" stroke="#cbb8ff" strokeWidth={1} strokeDasharray="6,3"
                className={llmBreathing ? 'breathe' : ''} />
          <BoxHeader x={LLM.x} y={LLM.y} w={LLM.w} rx={8}
                     label="LLM REASONING"
                     status={phase === 'llm-scanning' ? 'active' : phase === 'idle' || phase === 'customer' ? 'idle' : 'done'}
                     showCheck={phase === 'tools-executing' || phase === 'response' || phase === 'done'} />

          {/* Left pane: tool grid */}
          <text x={LLM_GRID_PANE.x + LLM_GRID_PANE.w / 2} y={LLM_GRID_PANE.y + 8}
                fontSize={10} fontFamily="'Geist Mono', monospace" fill="#888"
                textAnchor="middle" letterSpacing={1}>
            128 TOOLS
          </text>
          {gridRevealed && Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, i) => {
            const col = i % GRID_COLS;
            const row = Math.floor(i / GRID_COLS);
            const cx = GRID_ORIGIN_X + col * (GRID_CELL_W + GRID_GAP);
            const cy = GRID_ORIGIN_Y + row * (GRID_CELL_H + GRID_GAP);
            const delay = (col + row) * 20;

            const isSelected = selectedCells.has(i);
            if (detaching && isSelected) return null;
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
          })}

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
                      transform: detachEngaged ? detachTransform(cellIdx, toolIdx) : 'translate(0,0) scale(1,1)',
                      opacity: toolsVisible ? 0 : 1,
                    } as React.CSSProperties} />
            );
          })}

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
        </g>

        {/* Tool card placeholders */}
        <g style={{ opacity: toolsVisible ? 1 : 0, transition: 'opacity 0.25s' }}>
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
        </g>

        {/* Response with receipt rows and seal */}
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
      </svg>
    </div>
  );
}
