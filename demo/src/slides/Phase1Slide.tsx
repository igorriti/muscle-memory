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
