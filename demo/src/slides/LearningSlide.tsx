import { useEffect, useRef, useState, useCallback } from 'react';
import { NODE_STYLES, HEADER_COLOR, HEADER_H, type NodeCategory } from '../nodeStyles';

interface SlideProps {
  active: boolean;
  onComplete: () => void;
  onNarrate: (text: string) => void;
}

type NodeStatus = 'idle' | 'active' | 'done';

const TRACE_MESSAGES = [
  'Cancel order 412',
  'Cancel my order 523',
  'I need to cancel ORD-678',
  'Please undo order 891',
];

const VECTORS = [
  '[0.82, 0.91, ...]',
  '[0.81, 0.93, ...]',
  '[0.83, 0.90, ...]',
];

const NODE_DEFS = [
  { id: 'traces', label: 'TRACES', x: 20, y: 80, w: 190, h: 140, category: 'data' as NodeCategory },
  { id: 'embeddings', label: 'EMBEDDINGS', x: 240, y: 80, w: 170, h: 140, category: 'embedding' as NodeCategory },
  { id: 'clustering', label: 'CLUSTERING', x: 440, y: 80, w: 170, h: 140, category: 'data' as NodeCategory },
  { id: 'template', label: 'TEMPLATE STORE', x: 640, y: 80, w: 210, h: 140, category: 'template' as NodeCategory },
  { id: 'graph', label: 'GRAPH EXTRACTION', x: 260, y: 300, w: 340, h: 160, category: 'dag' as NodeCategory },
];

const EDGE_DEFS = [
  { id: 'e-traces-embed', from: 'traces', to: 'embeddings' },
  { id: 'e-embed-cluster', from: 'embeddings', to: 'clustering' },
  { id: 'e-cluster-graph', from: 'clustering', to: 'graph' },
  { id: 'e-graph-template', from: 'graph', to: 'template' },
];

function getNodeRect(id: string) {
  const n = NODE_DEFS.find(n => n.id === id)!;
  return { x: n.x, y: n.y, w: n.w, h: n.h };
}

function buildEdgePath(fromId: string, toId: string): string {
  const from = getNodeRect(fromId);
  const to = getNodeRect(toId);

  // Horizontal edges (same approximate y)
  if (Math.abs(from.y - to.y) < 50) {
    const x1 = from.x + from.w;
    const y1 = from.y + from.h / 2;
    const x2 = to.x;
    const y2 = to.y + to.h / 2;
    const cx1 = x1 + (x2 - x1) * 0.4;
    const cx2 = x1 + (x2 - x1) * 0.6;
    return `M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`;
  }

  // Cluster -> Graph (down)
  if (fromId === 'clustering' && toId === 'graph') {
    const x1 = from.x + from.w / 2;
    const y1 = from.y + from.h;
    const x2 = to.x + to.w / 2;
    const y2 = to.y;
    const mid = y1 + (y2 - y1) * 0.5;
    return `M${x1},${y1} C${x1},${mid} ${x2},${mid} ${x2},${y2}`;
  }

  // Graph -> Template (up-right)
  if (fromId === 'graph' && toId === 'template') {
    const x1 = to.x + to.w / 2;
    const y1 = to.y + to.h;
    const x2 = from.x + from.w;
    const y2 = from.y + from.h / 2;
    // Draw from graph right side up to template bottom
    const gx = from.x + from.w;
    const gy = from.y + from.h / 2;
    const tx = to.x + to.w / 2;
    const ty = to.y + to.h;
    const midY = gy + (ty - gy) * 0.5;
    return `M${gx},${gy} C${gx + 40},${gy} ${tx + 40},${ty} ${tx},${ty}`;
  }

  return '';
}

function statusColor(status: NodeStatus): string {
  if (status === 'active') return '#eab308';
  if (status === 'done') return '#22c55e';
  return '#999';
}

export function LearningSlide({ active, onComplete, onNarrate }: SlideProps) {
  const [visibleNodes, setVisibleNodes] = useState<Set<string>>(new Set());
  const [nodeStatus, setNodeStatus] = useState<Record<string, NodeStatus>>({});
  const [visibleEdges, setVisibleEdges] = useState<Set<string>>(new Set());
  const [visibleTraces, setVisibleTraces] = useState(0);
  const [showVectors, setShowVectors] = useState(false);
  const [clusterPhase, setClusterPhase] = useState(0); // 0=none, 1=spread, 2=grouped
  const [graphPhase, setGraphPhase] = useState(0); // 0=none, 1=nodes, 2=edges
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

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
      setVisibleTraces(0);
      setShowVectors(false);
      setClusterPhase(0);
      setGraphPhase(0);
      return;
    }

    // 0.0s
    onNarrate('After 1,000 executions, a pattern emerges.');

    // 0.5s - Traces node
    schedule(() => {
      showNode('traces', 'active');
    }, 500);

    // Fade in trace messages
    schedule(() => setVisibleTraces(1), 800);
    schedule(() => setVisibleTraces(2), 1100);
    schedule(() => setVisibleTraces(3), 1400);
    schedule(() => {
      setVisibleTraces(4);
      setStatus('traces', 'done');
    }, 1700);

    // 2.0s - Edge to Embeddings
    schedule(() => showEdge('e-traces-embed'), 2000);

    // 2.3s - Embeddings node
    schedule(() => {
      showNode('embeddings', 'active');
      setShowVectors(true);
    }, 2300);
    schedule(() => setStatus('embeddings', 'done'), 2600);

    // 2.8s - Narrate clustering
    schedule(() => onNarrate('Traces cluster by semantic similarity...'), 2800);

    // 3.0s - Edge to Clustering
    schedule(() => showEdge('e-embed-cluster'), 3000);

    // 3.3s - Clustering node
    schedule(() => {
      showNode('clustering', 'active');
      setClusterPhase(1);
    }, 3300);
    schedule(() => {
      setClusterPhase(2);
      setStatus('clustering', 'done');
    }, 3800);

    // 4.0s - Edge down to Graph
    schedule(() => showEdge('e-cluster-graph'), 4000);

    // 4.3s - Graph Extraction
    schedule(() => {
      showNode('graph', 'active');
      setGraphPhase(1);
    }, 4300);
    schedule(() => {
      setGraphPhase(2);
      setStatus('graph', 'done');
    }, 4800);

    // 5.5s
    schedule(() => {
      onNarrate('DAG extracted with weighted edges. Template stored.');
      showEdge('e-graph-template');
    }, 5500);

    // 5.8s - Template Store
    schedule(() => showNode('template', 'done'), 5800);

    // 7.0s
    schedule(() => onNarrate('Ready for Phase 3.'), 7000);

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [active]);

  const renderNodeBody = (id: string, def: typeof NODE_DEFS[0]) => {
    const bodyY = def.y + HEADER_H + 8;
    const bodyX = def.x + 8;

    if (id === 'traces') {
      return TRACE_MESSAGES.map((msg, i) => (
        <text
          key={`trace-${i}`}
          x={bodyX}
          y={bodyY + i * 20}
          fontSize={13}
          fontFamily="'Geist Mono', monospace"
          fill="#666"
          opacity={i < visibleTraces ? 1 : 0}
          style={{ transition: 'opacity 0.3s' }}
        >
          {msg}
        </text>
      ));
    }

    if (id === 'embeddings') {
      return VECTORS.map((v, i) => (
        <text
          key={`vec-${i}`}
          x={bodyX}
          y={bodyY + i * 20}
          fontSize={13}
          fontFamily="'Geist Mono', monospace"
          fill="#666"
          opacity={showVectors ? 1 : 0}
          style={{ transition: 'opacity 0.3s' }}
        >
          {v}
        </text>
      ));
    }

    if (id === 'clustering') {
      // Mini dot visualization
      const cx = def.x + def.w / 2;
      const cy = def.y + HEADER_H + (def.h - HEADER_H) / 2;
      const spread = clusterPhase === 0 ? 0 : clusterPhase === 1 ? 30 : 6;
      const dotPositions = [
        { dx: -spread, dy: -spread * 0.6 },
        { dx: spread, dy: -spread * 0.4 },
        { dx: -spread * 0.7, dy: spread * 0.8 },
        { dx: spread * 0.8, dy: spread * 0.5 },
      ];
      return (
        <>
          {dotPositions.map((p, i) => (
            <circle
              key={`dot-${i}`}
              cx={cx + p.dx}
              cy={cy - 8 + p.dy}
              r={4}
              fill="#1a1a1a"
              opacity={clusterPhase > 0 ? 1 : 0}
              style={{ transition: 'cx 0.5s ease-out, cy 0.5s ease-out, opacity 0.3s' }}
            />
          ))}
          {clusterPhase === 2 && (
            <text
              x={cx}
              y={cy + 28}
              fontSize={13}
              fontFamily="'Geist Mono', monospace"
              fill="#999"
              textAnchor="middle"
            >
              0.94 avg
            </text>
          )}
        </>
      );
    }

    if (id === 'template') {
      return (
        <>
          <text x={bodyX} y={bodyY + 4} fontSize={13} fontFamily="'Geist Mono', monospace" fill="#1a1a1a" fontWeight={600}>
            cancel_order
          </text>
          <text x={bodyX} y={bodyY + 22} fontSize={13} fontFamily="'Geist Mono', monospace" fill="#999">
            Confidence: 0.97
          </text>
          <text x={bodyX} y={bodyY + 38} fontSize={13} fontFamily="'Geist Mono', monospace" fill="#999">
            Executions: 847
          </text>
        </>
      );
    }

    if (id === 'graph') {
      // Mini DAG inside the graph extraction node
      const gx = def.x + 20;
      const gy = def.y + HEADER_H + 20;
      const miniNodes = [
        { id: 'mn-get', label: 'get_order', x: gx, y: gy },
        { id: 'mn-cancel', label: 'cancel_order', x: gx + 90, y: gy },
        { id: 'mn-refund', label: 'process_refund', x: gx + 190, y: gy + 50 },
        { id: 'mn-credit', label: 'create_credit', x: gx + 60, y: gy + 50 },
      ];
      const miniEdges = [
        { from: miniNodes[0], to: miniNodes[1], weight: '0.95', dashed: false },
        { from: miniNodes[1], to: miniNodes[2], weight: '0.80', dashed: false },
        { from: miniNodes[1], to: miniNodes[3], weight: '0.20', dashed: true },
      ];

      return (
        <>
          {/* Mini edges */}
          {graphPhase >= 2 && miniEdges.map((e, i) => (
            <g key={`me-${i}`}>
              <line
                x1={e.from.x + 35}
                y1={e.from.y + 12}
                x2={e.to.x}
                y2={e.to.y + 12}
                stroke="#ccc"
                strokeWidth={1}
                strokeDasharray={e.dashed ? '3,3' : 'none'}
              />
              <text
                x={(e.from.x + 35 + e.to.x) / 2}
                y={(e.from.y + e.to.y) / 2 + 6}
                fontSize={10}
                fontFamily="'Geist Mono', monospace"
                fill="#999"
                textAnchor="middle"
              >
                {e.weight}
              </text>
            </g>
          ))}
          {/* Mini nodes */}
          {graphPhase >= 1 && miniNodes.map(mn => (
            <g key={mn.id}>
              <rect
                x={mn.x}
                y={mn.y}
                width={70}
                height={24}
                rx={3}
                fill="#fafafa"
                stroke="#eaeaea"
                strokeWidth={1}
              />
              <text
                x={mn.x + 35}
                y={mn.y + 14}
                fontSize={9}
                fontFamily="'Geist Mono', monospace"
                fill="#666"
                textAnchor="middle"
              >
                {mn.label}
              </text>
            </g>
          ))}
        </>
      );
    }

    return null;
  };

  const renderNode = (def: typeof NODE_DEFS[0]) => {
    const isVisible = visibleNodes.has(def.id);
    const status = nodeStatus[def.id] || 'idle';
    const style = NODE_STYLES[def.category];

    return (
      <g key={def.id} className={`svg-node${isVisible ? ' visible' : ''}`}>
        {/* Container */}
        <rect x={def.x} y={def.y} width={def.w} height={def.h} rx={style.rx}
              fill={style.bodyFill} stroke={style.bodyStroke} strokeWidth={1}
              strokeDasharray={style.bodyStrokeDash || undefined} />
        {/* Header */}
        <rect x={def.x} y={def.y} width={def.w} height={HEADER_H} rx={style.rx} fill={HEADER_COLOR} />
        <rect x={def.x} y={def.y + HEADER_H - style.rx} width={def.w} height={style.rx} fill={HEADER_COLOR} />
        {/* Left accent bar */}
        {style.hasLeftBar && (
          <rect x={def.x + 1} y={def.y + HEADER_H} width={3} height={def.h - HEADER_H - 1}
                fill={style.accentColor} />
        )}
        {/* Inner border (embedding) */}
        {style.hasInnerBorder && (
          <rect x={def.x + 4} y={def.y + HEADER_H + 4} width={def.w - 8} height={def.h - HEADER_H - 8}
                rx={Math.max(style.rx - 4, 2)} fill="none" stroke="#d0d0d0" strokeWidth={1} strokeDasharray="3,3" />
        )}
        {/* Status light */}
        <circle cx={def.x + 12} cy={def.y + HEADER_H / 2} r={4}
                fill={statusColor(status)} className={status === 'active' ? 'status-pulse' : ''} />
        {/* Header text */}
        <text x={def.x + 24} y={def.y + HEADER_H / 2 + 1} fontSize={10}
              fontFamily="'Geist Mono', monospace" fill="#fff" dominantBaseline="middle">
          {def.label}
        </text>
        {/* Bottom bar (response) */}
        {style.hasBottomBar && (
          <rect x={def.x + 2} y={def.y + def.h - 5} width={def.w - 4} height={4} rx={2} fill={style.accentColor} />
        )}
        {/* Body content */}
        {renderNodeBody(def.id, def)}
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

  return (
    <div className="slide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={960} height={520} viewBox="0 0 960 520">
        {/* Edges behind nodes */}
        {EDGE_DEFS.map(renderEdge)}
        {/* Nodes */}
        {NODE_DEFS.map(renderNode)}
      </svg>
    </div>
  );
}
