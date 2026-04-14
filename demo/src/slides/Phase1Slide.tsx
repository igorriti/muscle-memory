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

const HEADER_H = 28;
const HEADER_FILL = '#1a1a1a';

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
        <BoxHeader x={CUSTOMER.x} y={CUSTOMER.y} w={CUSTOMER.w} rx={8}
                   label="CUSTOMER MESSAGE" status={phase === 'idle' ? 'idle' : 'done'} showCheck={phase !== 'idle'} />

        {/* LLM workspace placeholder */}
        <rect x={LLM.x} y={LLM.y} width={LLM.w} height={LLM.h}
              rx={8} fill="#f6f2ff" stroke="#cbb8ff" strokeWidth={1} strokeDasharray="6,3" />
        <BoxHeader x={LLM.x} y={LLM.y} w={LLM.w} rx={8}
                   label="LLM REASONING"
                   status={phase === 'llm-scanning' ? 'active' : phase === 'idle' || phase === 'customer' ? 'idle' : 'done'}
                   showCheck={phase === 'tools-executing' || phase === 'response' || phase === 'done'} />

        {/* Tool card placeholders */}
        {TOOLS.map(t => (
          <g key={t.id}>
            <rect x={t.x} y={TOOL_Y} width={TOOL_W} height={TOOL_H}
                  rx={4} fill="#282835" stroke="#3a3a48" strokeWidth={1} />
            <BoxHeader x={t.x} y={TOOL_Y} w={TOOL_W} rx={4}
                       label={t.label}
                       status={phase === 'response' || phase === 'done' ? 'done' : phase === 'tools-executing' ? 'active' : 'idle'}
                       showCheck={phase === 'response' || phase === 'done'} />
          </g>
        ))}

        {/* Response placeholder */}
        <rect x={RESPONSE.x} y={RESPONSE.y} width={RESPONSE.w} height={RESPONSE.h}
              rx={8} fill="#effdf4" stroke="#86efac" strokeWidth={1} />
        <BoxHeader x={RESPONSE.x} y={RESPONSE.y} w={RESPONSE.w} rx={8}
                   label="RESPONSE" status={phase === 'done' ? 'done' : 'idle'} showCheck={phase === 'done'} />
      </svg>
    </div>
  );
}
