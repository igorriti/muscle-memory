import { useEffect, useRef, useState, useCallback } from 'react';
import { QUERY_PATTERNS, makeQuery, CANCEL_ORDER_DAG, BENCHMARK_STATS } from '../benchmarkData';

interface SlideProps {
  active: boolean;
  onComplete: () => void;
  onNarrate: (text: string) => void;
}

// Shared design constants (match Phase1/Phase3Slide)
const HEADER_H = 32;
const SURFACE_FILL = '#fff';
const SURFACE_STROKE = '#d4d4d4';
const LABEL_COLOR = '#666';
const DIVIDER_COLOR = '#e5e5e5';

type NodeStatus = 'idle' | 'active' | 'done';

function statusColor(s: NodeStatus): string {
  if (s === 'active') return '#eab308';
  if (s === 'done') return '#22c55e';
  return '#bbb';
}

function BoxHeader({ x, y, w, label, status, showCheck }: {
  x: number; y: number; w: number; label: string; status: NodeStatus; showCheck?: boolean;
}) {
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

// Layout (viewBox 960x680) — S-flow: 3 top, 2 bottom
const NODE_DEFS = [
  { id: 'traces',     label: 'TRACES',           x: 40,  y: 110, w: 260, h: 200 },
  { id: 'embeddings', label: 'EMBEDDINGS',       x: 335, y: 110, w: 260, h: 200 },
  { id: 'clustering', label: 'CLUSTERING',       x: 630, y: 110, w: 290, h: 200 },
  { id: 'graph',      label: 'GRAPH EXTRACTION', x: 40,  y: 390, w: 555, h: 235 },
  { id: 'template',   label: 'TEMPLATE STORE',   x: 630, y: 390, w: 290, h: 235 },
];
type NodeDef = typeof NODE_DEFS[number];

function getNode(id: string): NodeDef {
  return NODE_DEFS.find(n => n.id === id)!;
}

// Trace messages come from the benchmark's cancel_order query pattern.
const TRACE_MESSAGES = [5, 57, 81, 130].map(i => makeQuery('cancel_order', i));

const VECTORS = [
  '[0.82, 0.91, ...]',
  '[0.81, 0.93, ...]',
  '[0.83, 0.90, ...]',
];

const EDGE_DEFS = [
  { id: 'e-traces-embed',   from: 'traces',     to: 'embeddings' },
  { id: 'e-embed-cluster',  from: 'embeddings', to: 'clustering' },
  { id: 'e-cluster-graph',  from: 'clustering', to: 'graph' },
  { id: 'e-graph-template', from: 'graph',      to: 'template' },
];

function buildEdgePath(fromId: string, toId: string): string {
  const f = getNode(fromId);
  const t = getNode(toId);

  // Horizontal (same row)
  if (Math.abs(f.y - t.y) < 40) {
    const x1 = f.x + f.w;
    const y1 = f.y + f.h / 2;
    const x2 = t.x;
    const y2 = t.y + t.h / 2;
    const cx1 = x1 + (x2 - x1) * 0.4;
    const cx2 = x1 + (x2 - x1) * 0.6;
    return `M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`;
  }

  // Clustering → Graph (diagonal down-left)
  if (fromId === 'clustering' && toId === 'graph') {
    const x1 = f.x + f.w / 2;
    const y1 = f.y + f.h;
    const x2 = t.x + t.w * 0.75;
    const y2 = t.y;
    const midY = y1 + (y2 - y1) * 0.5;
    return `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`;
  }

  return '';
}

export function LearningSlide({ active, onNarrate }: SlideProps) {
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [visibleNodes, setVisibleNodes] = useState<Set<string>>(new Set());
  const [nodeStatus, setNodeStatus] = useState<Record<string, NodeStatus>>({});
  const [visibleEdges, setVisibleEdges] = useState<Set<string>>(new Set());
  const [visibleTraces, setVisibleTraces] = useState(0);
  const [showVectors, setShowVectors] = useState(false);
  const [clusterPhase, setClusterPhase] = useState(0); // 0=hidden 1=spread 2=grouped 3=halo+readout
  const [graphNodesVisible, setGraphNodesVisible] = useState(0);
  const [edgeProgress, setEdgeProgress] = useState<number[]>([0, 0, 0, 0]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rafRef = useRef<number[]>([]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
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

  const animateEdge = useCallback((idx: number, duration = 600) => {
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      setEdgeProgress(prev => {
        const next = [...prev];
        next[idx] = eased;
        return next;
      });
      if (p < 1) {
        const id = requestAnimationFrame(step);
        rafRef.current.push(id);
      }
    };
    const id = requestAnimationFrame(step);
    rafRef.current.push(id);
  }, []);

  useEffect(() => {
    if (!active) {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      rafRef.current.forEach(cancelAnimationFrame);
      rafRef.current = [];
      setPhase('idle');
      setVisibleNodes(new Set());
      setNodeStatus({});
      setVisibleEdges(new Set());
      setVisibleTraces(0);
      setShowVectors(false);
      setClusterPhase(0);
      setGraphNodesVisible(0);
      setEdgeProgress([0, 0, 0, 0]);
      return;
    }

    setPhase('running');
    onNarrate(`After ${BENCHMARK_STATS.totalQueries.toLocaleString()} queries across ${BENCHMARK_STATS.patternCount} patterns, templates emerge.`);

    schedule(() => showNode('traces', 'active'), 500);
    schedule(() => setVisibleTraces(1), 800);
    schedule(() => setVisibleTraces(2), 1100);
    schedule(() => setVisibleTraces(3), 1400);
    schedule(() => {
      setVisibleTraces(4);
      setStatus('traces', 'done');
    }, 1700);

    schedule(() => showEdge('e-traces-embed'), 2000);
    schedule(() => {
      showNode('embeddings', 'active');
      setShowVectors(true);
    }, 2300);
    schedule(() => setStatus('embeddings', 'done'), 2700);

    schedule(() => onNarrate('Traces cluster by semantic similarity...'), 2900);
    schedule(() => showEdge('e-embed-cluster'), 3100);
    schedule(() => {
      showNode('clustering', 'active');
      setClusterPhase(1);
    }, 3400);
    schedule(() => setClusterPhase(2), 3900);
    schedule(() => {
      setClusterPhase(3);
      setStatus('clustering', 'done');
    }, 4300);

    schedule(() => showEdge('e-cluster-graph'), 4600);
    schedule(() => {
      showNode('graph', 'active');
    }, 4900);
    // Stagger node reveals (200ms apart)
    schedule(() => setGraphNodesVisible(1), 5000);
    schedule(() => setGraphNodesVisible(2), 5200);
    schedule(() => setGraphNodesVisible(3), 5400);
    schedule(() => setGraphNodesVisible(4), 5600);
    schedule(() => setGraphNodesVisible(5), 5800);
    // Sequential edges with count-up weights
    schedule(() => animateEdge(0), 6050);
    schedule(() => animateEdge(1), 6500);
    schedule(() => animateEdge(2), 6950);
    schedule(() => animateEdge(3), 7400);
    schedule(() => setStatus('graph', 'done'), 8000);

    schedule(() => {
      onNarrate('DAG extracted with weighted edges. Template stored.');
      showEdge('e-graph-template');
    }, 8250);
    schedule(() => showNode('template', 'done'), 8550);

    schedule(() => onNarrate('Ready for Phase 3.'), 9500);
    schedule(() => setPhase('done'), 9700);

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      rafRef.current.forEach(cancelAnimationFrame);
      rafRef.current = [];
    };
  }, [active]);

  const interactive = phase === 'done';

  // ── Body renderers ──────────────────────────────────────────────
  const renderTracesBody = (def: NodeDef) => {
    const bodyX = def.x + 16;
    const bodyY = def.y + HEADER_H + 26;
    return TRACE_MESSAGES.map((msg, i) => (
      <text key={`trace-${i}`}
            x={bodyX} y={bodyY + i * 30}
            fontSize={13} fontFamily="'Geist Mono', monospace"
            fill="#1a1a1a"
            opacity={i < visibleTraces ? 1 : 0}
            style={{ transition: 'opacity 0.3s' }}>
        {msg}
      </text>
    ));
  };

  const renderEmbeddingsBody = (def: NodeDef) => {
    const bodyX = def.x + 16;
    const bodyY = def.y + HEADER_H + 34;
    return VECTORS.map((v, i) => (
      <text key={`vec-${i}`}
            x={bodyX} y={bodyY + i * 32}
            fontSize={13} fontFamily="'Geist Mono', monospace"
            fill="#1a1a1a"
            opacity={showVectors ? 1 : 0}
            style={{ transition: 'opacity 0.3s', transitionDelay: `${i * 120}ms` }}>
        {v}
      </text>
    ));
  };

  const renderClusteringBody = (def: NodeDef) => {
    const cx = def.x + def.w / 2;
    const cy = def.y + HEADER_H + 58;
    const spread = clusterPhase === 0 ? 0 : clusterPhase === 1 ? 36 : 7;
    const mainDots = [
      { dx: -spread,       dy: -spread * 0.7 },
      { dx: spread,        dy: -spread * 0.4 },
      { dx: -spread * 0.7, dy: spread * 0.8 },
      { dx: spread * 0.8,  dy: spread * 0.5 },
    ];
    // Secondary clusters — tighter, fainter, represent other discovered patterns
    const secSpread = clusterPhase === 0 ? 0 : clusterPhase === 1 ? 22 : 4;
    const secClusters = [
      {
        cx: cx - 92, cy: cy - 12,
        dots: [
          { dx: -secSpread * 0.8, dy: -secSpread * 0.5 },
          { dx: secSpread * 0.7,  dy: -secSpread * 0.3 },
          { dx: -secSpread * 0.3, dy: secSpread * 0.7  },
        ],
      },
      {
        cx: cx + 95, cy: cy + 8,
        dots: [
          { dx: -secSpread * 0.7, dy: -secSpread * 0.6 },
          { dx: secSpread * 0.8,  dy: -secSpread * 0.2 },
          { dx: -secSpread * 0.2, dy: secSpread * 0.8  },
        ],
      },
    ];
    const showHalo = clusterPhase >= 3;
    const showReadout = clusterPhase >= 3;
    return (
      <g>
        {/* Secondary clusters — dim */}
        {secClusters.map((sc, si) => (
          <g key={`sec-${si}`}
             opacity={clusterPhase > 0 ? (clusterPhase >= 3 ? 0.35 : 0.55) : 0}
             style={{ transition: 'opacity 0.4s ease-out' }}>
            <circle cx={sc.cx} cy={sc.cy} r={16}
                    fill="none" stroke="#999" strokeWidth={1}
                    strokeDasharray="2,3" opacity={clusterPhase >= 2 ? 1 : 0}
                    style={{ transition: 'opacity 0.4s ease-out' }} />
            {sc.dots.map((p, i) => (
              <circle key={`sd-${si}-${i}`}
                      cx={sc.cx + p.dx} cy={sc.cy + p.dy} r={3}
                      fill="#666"
                      style={{ transition: 'cx 0.5s ease-out, cy 0.5s ease-out' }} />
            ))}
          </g>
        ))}
        {/* Main cluster halo */}
        <circle cx={cx} cy={cy} r={26}
                fill="none" stroke="#1a1a1a" strokeWidth={1}
                strokeDasharray="3,3"
                opacity={showHalo ? 0.7 : 0}
                style={{ transition: 'opacity 0.4s ease-out' }} />
        {mainDots.map((p, i) => (
          <circle key={`dot-${i}`}
                  cx={cx + p.dx} cy={cy + p.dy} r={5}
                  fill="#1a1a1a"
                  opacity={clusterPhase > 0 ? 1 : 0}
                  style={{ transition: 'cx 0.5s ease-out, cy 0.5s ease-out, opacity 0.3s' }} />
        ))}
        {/* Two-line readout */}
        <text x={cx} y={cy + 62} fontSize={12}
              fontFamily="'Geist Mono', monospace" fill="#1a1a1a"
              textAnchor="middle"
              opacity={showReadout ? 1 : 0}
              style={{ transition: 'opacity 0.4s ease-out' }}>
          4 similar intents
        </text>
        <text x={cx} y={cy + 80} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}
              textAnchor="middle" letterSpacing={0.5}
              opacity={showReadout ? 1 : 0}
              style={{ transition: 'opacity 0.4s ease-out', transitionDelay: '0.1s' }}>
          0.94 similarity
        </text>
      </g>
    );
  };

  const renderTemplateBody = (def: NodeDef) => {
    const x = def.x + 16;
    const topY = def.y + HEADER_H + 32;
    return (
      <g>
        <text x={x} y={topY} fontSize={14}
              fontFamily="'Geist Mono', monospace" fill="#1a1a1a" fontWeight={600}>
          cancel_order
        </text>
        <line x1={x} y1={topY + 12} x2={def.x + def.w - 16} y2={topY + 12}
              stroke={DIVIDER_COLOR} strokeWidth={1} />
        <text x={x} y={topY + 34} fontSize={12}
              fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}>
          confidence
        </text>
        <text x={def.x + def.w - 16} y={topY + 34} fontSize={12}
              fontFamily="'Geist Mono', monospace" fill="#1a1a1a" textAnchor="end">
          0.97
        </text>
        <text x={x} y={topY + 58} fontSize={12}
              fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}>
          executions
        </text>
        <text x={def.x + def.w - 16} y={topY + 58} fontSize={12}
              fontFamily="'Geist Mono', monospace" fill="#1a1a1a" textAnchor="end">
          {BENCHMARK_STATS.memoryHits}
        </text>
        <text x={x} y={topY + 82} fontSize={12}
              fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}>
          nodes
        </text>
        <text x={def.x + def.w - 16} y={topY + 82} fontSize={12}
              fontFamily="'Geist Mono', monospace" fill="#1a1a1a" textAnchor="end">
          {CANCEL_ORDER_DAG.nodes.length}
        </text>
      </g>
    );
  };

  const renderGraphBody = (def: NodeDef) => {
    const gx = def.x + 32;
    const gy = def.y + HEADER_H + 36;
    const nodeW = 115;
    const nodeH = 36;
    const colGap = 150;
    const rowGap = 92;
    // Layout positions for the 5 DAG nodes (indices match CANCEL_ORDER_DAG.nodes).
    const nodePositions = [
      { x: gx,                y: gy },            // get_order
      { x: gx + colGap,       y: gy },            // get_order_status
      { x: gx + colGap * 2,   y: gy },            // cancel_order
      { x: gx + colGap * 0.8, y: gy + rowGap },   // get_order_total (rare branch)
      { x: gx + colGap * 2,   y: gy + rowGap },   // refund_payment
    ];
    const miniNodes = CANCEL_ORDER_DAG.nodes.map((label, i) => ({
      label, x: nodePositions[i].x, y: nodePositions[i].y,
    }));
    const miniEdges = CANCEL_ORDER_DAG.edges.map(e => ({
      fromIdx: e.from, toIdx: e.to, weightFinal: e.weight, dashed: e.dashed,
    }));
    const centerOf = (n: typeof miniNodes[number]) => ({
      cx: n.x + nodeW / 2, cy: n.y + nodeH / 2,
    });
    return (
      <g>
        {/* Edges (behind nodes) */}
        {miniEdges.map((e, i) => {
          const a = centerOf(miniNodes[e.fromIdx]);
          const b = centerOf(miniNodes[e.toIdx]);
          const p = edgeProgress[i];
          if (p <= 0) return null;
          const x2 = a.cx + (b.cx - a.cx) * p;
          const y2 = a.cy + (b.cy - a.cy) * p;
          const weight = (e.weightFinal * p).toFixed(2);
          const labelOpacity = p > 0.5 ? (p - 0.5) * 2 : 0;
          return (
            <g key={`me-${i}`}>
              <line x1={a.cx} y1={a.cy} x2={x2} y2={y2}
                    stroke={e.dashed ? '#bbb' : '#1a1a1a'}
                    strokeWidth={e.dashed ? 1 : 1.5}
                    strokeDasharray={e.dashed ? '3,3' : undefined} />
              <text x={(a.cx + b.cx) / 2} y={(a.cy + b.cy) / 2 - 6}
                    fontSize={11} fontFamily="'Geist Mono', monospace"
                    fill={LABEL_COLOR} textAnchor="middle"
                    opacity={labelOpacity}>
                {weight}
              </text>
            </g>
          );
        })}
        {/* Nodes (staggered) */}
        {miniNodes.map((mn, i) => (
          <g key={`mn-${i}`}
             opacity={i < graphNodesVisible ? 1 : 0}
             style={{ transition: 'opacity 0.3s ease-out' }}>
            <rect x={mn.x} y={mn.y} width={nodeW} height={nodeH} rx={6}
                  fill={SURFACE_FILL} stroke={SURFACE_STROKE} strokeWidth={1} />
            <text x={mn.x + nodeW / 2} y={mn.y + nodeH / 2 + 1}
                  fontSize={12} fontFamily="'Geist Mono', monospace"
                  fill="#1a1a1a" textAnchor="middle" dominantBaseline="middle">
              {mn.label}
            </text>
          </g>
        ))}
      </g>
    );
  };

  const renderBody = (def: NodeDef) => {
    switch (def.id) {
      case 'traces':     return renderTracesBody(def);
      case 'embeddings': return renderEmbeddingsBody(def);
      case 'clustering': return renderClusteringBody(def);
      case 'template':   return renderTemplateBody(def);
      case 'graph':      return renderGraphBody(def);
      default:           return null;
    }
  };

  return (
    <div className="slide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={1248} height={884} viewBox="0 0 960 680">
        {/* Edges behind nodes */}
        {EDGE_DEFS.map(e => {
          const d = buildEdgePath(e.from, e.to);
          const visible = visibleEdges.has(e.id);
          return (
            <path key={e.id} d={d}
                  className={`svg-edge${visible ? ' visible' : ''}`}
                  stroke="#ccc" strokeWidth={1.5} fill="none" />
          );
        })}

        {/* Nodes */}
        {NODE_DEFS.map(def => {
          const isVisible = visibleNodes.has(def.id);
          const status = nodeStatus[def.id] || 'idle';
          return (
            <g key={def.id}
               className={interactive ? 'card-interactive' : undefined}
               style={{ opacity: isVisible ? 1 : 0, transition: 'opacity 0.3s ease-out' }}>
              <rect x={def.x} y={def.y} width={def.w} height={def.h}
                    rx={8} fill={SURFACE_FILL} stroke={SURFACE_STROKE} strokeWidth={1} />
              <BoxHeader x={def.x} y={def.y} w={def.w}
                         label={def.label} status={status}
                         showCheck={status === 'done'} />
              {renderBody(def)}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
