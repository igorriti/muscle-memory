import { useEffect, useRef, useState, useCallback } from 'react';

interface SlideProps {
  active: boolean;
  onComplete: () => void;
  onNarrate: (text: string) => void;
}

type NodeStatus = 'idle' | 'active' | 'done';

const NODE_DEFS = [
  { id: 'customer', label: 'CUSTOMER MESSAGE', x: 130, y: 20, w: 200, h: 80, body: 'Cancel my order ORD-412' },
  { id: 'llm', label: 'LLM REASONING', x: 130, y: 150, w: 200, h: 80, body: 'Analyzing intent...' },
  { id: 'get_order', label: 'GET_ORDER', x: 60, y: 300, w: 100, h: 60, body: '' },
  { id: 'cancel_order', label: 'CANCEL_ORDER', x: 180, y: 300, w: 120, h: 60, body: '' },
  { id: 'process_refund', label: 'PROCESS_REFUND', x: 320, y: 300, w: 130, h: 60, body: '' },
  { id: 'response', label: 'RESPONSE', x: 130, y: 420, w: 200, h: 80, body: '4.2s -- $0.021' },
];

const EDGE_DEFS = [
  { id: 'e-customer-llm', from: 'customer', to: 'llm' },
  { id: 'e-llm-get', from: 'llm', to: 'get_order' },
  { id: 'e-llm-cancel', from: 'llm', to: 'cancel_order' },
  { id: 'e-llm-refund', from: 'llm', to: 'process_refund' },
  { id: 'e-get-response', from: 'get_order', to: 'response' },
  { id: 'e-cancel-response', from: 'cancel_order', to: 'response' },
  { id: 'e-refund-response', from: 'process_refund', to: 'response' },
];

function getNodeRect(id: string) {
  const n = NODE_DEFS.find(n => n.id === id)!;
  return { x: n.x, y: n.y, w: n.w, h: n.h };
}

function buildEdgePath(fromId: string, toId: string): string {
  const from = getNodeRect(fromId);
  const to = getNodeRect(toId);
  const x1 = from.x + from.w / 2;
  const y1 = from.y + from.h;
  const x2 = to.x + to.w / 2;
  const y2 = to.y;
  const cy1 = y1 + (y2 - y1) * 0.4;
  const cy2 = y1 + (y2 - y1) * 0.6;
  return `M${x1},${y1} C${x1},${cy1} ${x2},${cy2} ${x2},${y2}`;
}

function statusColor(status: NodeStatus): string {
  if (status === 'active') return '#eab308';
  if (status === 'done') return '#22c55e';
  return '#999';
}

const TOOL_GRID_COLS = 8;
const TOOL_GRID_ROWS = 16;
const TOOL_COUNT = TOOL_GRID_COLS * TOOL_GRID_ROWS;
const SELECTED_TOOL_INDICES = [19, 54, 87];

export function Phase1Slide({ active, onComplete, onNarrate }: SlideProps) {
  const [visibleNodes, setVisibleNodes] = useState<Set<string>>(new Set());
  const [nodeStatus, setNodeStatus] = useState<Record<string, NodeStatus>>({});
  const [visibleEdges, setVisibleEdges] = useState<Set<string>>(new Set());
  const [activeToolIndices, setActiveToolIndices] = useState<Set<number>>(new Set());
  const [selectedTools, setSelectedTools] = useState<Set<number>>(new Set());
  const [llmProgress, setLlmProgress] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const flashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
    return t;
  }, []);

  const showNode = useCallback((id: string, status: NodeStatus = 'idle') => {
    setVisibleNodes(prev => new Set(prev).add(id));
    setNodeStatus(prev => ({ ...prev, [id]: status }));
  }, []);

  const setStatus = useCallback((id: string, status: NodeStatus) => {
    setNodeStatus(prev => ({ ...prev, [id]: status }));
  }, []);

  const showEdge = useCallback((id: string) => {
    setVisibleEdges(prev => new Set(prev).add(id));
  }, []);

  useEffect(() => {
    if (!active) {
      setVisibleNodes(new Set());
      setNodeStatus({});
      setVisibleEdges(new Set());
      setActiveToolIndices(new Set());
      setSelectedTools(new Set());
      setLlmProgress(0);
      return;
    }

    // 0.0s
    onNarrate('Request received: Cancel my order ORD-412');

    // 0.3s - Customer node
    schedule(() => showNode('customer', 'done'), 300);

    // 1.0s - Edge customer -> llm
    schedule(() => showEdge('e-customer-llm'), 1000);

    // 1.3s - LLM node active
    schedule(() => showNode('llm', 'active'), 1300);

    // 1.5s - Start tool scanning
    schedule(() => {
      onNarrate('LLM scanning 128 tools...');
      setLlmProgress(10);
    }, 1500);

    // 1.5s-3.5s - Tool grid flashing
    schedule(() => {
      let flashCount = 0;
      flashIntervalRef.current = setInterval(() => {
        const idx = Math.floor(Math.random() * TOOL_COUNT);
        setActiveToolIndices(new Set([idx]));
        flashCount++;
        setLlmProgress(Math.min(90, 10 + (flashCount / 130) * 80));
        if (flashCount > 130) {
          if (flashIntervalRef.current) clearInterval(flashIntervalRef.current);
          flashIntervalRef.current = null;
          setActiveToolIndices(new Set());
        }
      }, 15);
    }, 1500);

    // 3.5s - Tools selected
    schedule(() => {
      onNarrate('Tools selected. Executing plan...');
      setStatus('llm', 'done');
      setLlmProgress(100);
      setSelectedTools(new Set(SELECTED_TOOL_INDICES));
      setActiveToolIndices(new Set());
      if (flashIntervalRef.current) {
        clearInterval(flashIntervalRef.current);
        flashIntervalRef.current = null;
      }
    }, 3500);

    // 3.8s - Fan-out edges
    schedule(() => {
      showEdge('e-llm-get');
      showEdge('e-llm-cancel');
      showEdge('e-llm-refund');
    }, 3800);

    // 4.0s - GET_ORDER
    schedule(() => showNode('get_order', 'active'), 4000);
    schedule(() => setStatus('get_order', 'done'), 4400);

    // 4.5s - CANCEL_ORDER
    schedule(() => showNode('cancel_order', 'active'), 4500);
    schedule(() => setStatus('cancel_order', 'done'), 4900);

    // 5.0s - PROCESS_REFUND
    schedule(() => showNode('process_refund', 'active'), 5000);
    schedule(() => setStatus('process_refund', 'done'), 5400);

    // 5.5s - Converge edges
    schedule(() => {
      showEdge('e-get-response');
      showEdge('e-cancel-response');
      showEdge('e-refund-response');
    }, 5500);

    // 5.8s - Response node
    schedule(() => showNode('response', 'done'), 5800);

    // 6.0s
    schedule(() => onNarrate('Response generated. 4.2s, $0.021 per request'), 6000);

    // 7.5s
    schedule(() => onComplete(), 7500);

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      if (flashIntervalRef.current) {
        clearInterval(flashIntervalRef.current);
        flashIntervalRef.current = null;
      }
    };
  }, [active]);

  const renderNode = (def: typeof NODE_DEFS[0]) => {
    const isVisible = visibleNodes.has(def.id);
    const status = nodeStatus[def.id] || 'idle';
    const headerH = 24;
    const isLlm = def.id === 'llm';

    return (
      <g
        key={def.id}
        className={`svg-node${isVisible ? ' visible' : ''}`}
      >
        {/* Container */}
        <rect x={def.x} y={def.y} width={def.w} height={def.h} rx={6} fill="#fff" stroke="#eaeaea" strokeWidth={1} />
        {/* Dark header */}
        <rect x={def.x} y={def.y} width={def.w} height={headerH} rx={6} fill="#1a1a1a" />
        <rect x={def.x} y={def.y + headerH - 6} width={def.w} height={6} fill="#1a1a1a" />
        {/* Status light */}
        <circle
          cx={def.x + 10}
          cy={def.y + headerH / 2}
          r={3}
          fill={statusColor(status)}
          className={status === 'active' ? 'status-pulse' : ''}
        />
        {/* Header text */}
        <text
          x={def.x + 20}
          y={def.y + headerH / 2 + 1}
          fontSize={8}
          fontFamily="'Geist Mono', monospace"
          fill="#fff"
          dominantBaseline="middle"
        >
          {def.label}
        </text>
        {/* Done checkmark */}
        {status === 'done' && (
          <text
            x={def.x + def.w - 14}
            y={def.y + headerH / 2 + 1}
            fontSize={10}
            fill="#22c55e"
            dominantBaseline="middle"
            fontFamily="'Geist Mono', monospace"
          >
            &#10003;
          </text>
        )}
        {/* Body content */}
        {def.body && (
          <text
            x={def.x + def.w / 2}
            y={def.y + headerH + (def.h - headerH) / 2}
            fontSize={10}
            fontFamily="'Geist Mono', monospace"
            fill="#666"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {def.body}
          </text>
        )}
        {/* LLM progress bar */}
        {isLlm && (
          <g>
            <rect x={def.x + 12} y={def.y + def.h - 16} width={def.w - 24} height={3} rx={1.5} fill="#eaeaea" />
            <rect
              x={def.x + 12}
              y={def.y + def.h - 16}
              width={(def.w - 24) * (llmProgress / 100)}
              height={3}
              rx={1.5}
              fill={llmProgress >= 100 ? '#22c55e' : '#1a1a1a'}
              style={{ transition: 'width 0.3s' }}
            />
          </g>
        )}
      </g>
    );
  };

  const renderEdge = (edge: typeof EDGE_DEFS[0]) => {
    const isVisible = visibleEdges.has(edge.id);
    const d = buildEdgePath(edge.from, edge.to);
    return (
      <path
        key={edge.id}
        d={d}
        className={`svg-edge${isVisible ? ' visible' : ''}`}
        stroke="#ccc"
        strokeWidth={1.5}
        fill="none"
      />
    );
  };

  const renderToolGrid = () => {
    const startX = 500;
    const startY = 50;
    const cellW = 20;
    const cellH = 14;
    const gap = 3;
    const rects = [];

    for (let i = 0; i < TOOL_COUNT; i++) {
      const col = i % TOOL_GRID_COLS;
      const row = Math.floor(i / TOOL_GRID_COLS);
      const x = startX + col * (cellW + gap);
      const y = startY + row * (cellH + gap);
      const isActive = activeToolIndices.has(i);
      const isSelected = selectedTools.has(i);
      let fill = '#eaeaea';
      if (isSelected) fill = '#1a1a1a';
      else if (isActive) fill = '#1a1a1a';

      rects.push(
        <rect
          key={`tool-${i}`}
          x={x}
          y={y}
          width={cellW}
          height={cellH}
          rx={2}
          fill={fill}
          style={{ transition: isSelected ? 'none' : 'fill 0.1s' }}
        />
      );
    }

    return (
      <g>
        <text
          x={startX + (TOOL_GRID_COLS * (cellW + gap) - gap) / 2}
          y={startY - 12}
          fontSize={10}
          fontFamily="'Geist Mono', monospace"
          fill="#999"
          textAnchor="middle"
        >
          128 AVAILABLE TOOLS
        </text>
        {rects}
      </g>
    );
  };

  return (
    <div className="slide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={900} height={520} viewBox="0 0 900 520">
        {/* Edges behind nodes */}
        {EDGE_DEFS.map(renderEdge)}
        {/* Nodes */}
        {NODE_DEFS.map(renderNode)}
        {/* Tool grid */}
        {renderToolGrid()}
      </svg>
    </div>
  );
}
