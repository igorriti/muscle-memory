import { useEffect, useRef, useState, useCallback } from 'react';
import { BENCHMARK_STATS, makeQuery } from '../benchmarkData';

interface SlideProps {
  active: boolean;
  onComplete: () => void;
  onNarrate: (text: string) => void;
}

// Shared design constants (match Phase1/LearningSlide)
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

// ── Layout (viewBox 960x680) ────────────────────────────────────
// Vertical pipeline on left
const PIPE_X = 40;
const PIPE_W = 290;
const PIPE_Y0 = 40;
const PIPE_H = 112;
const PIPE_GAP = 12;
const pipeY = (i: number) => PIPE_Y0 + i * (PIPE_H + PIPE_GAP);

type NodeId = 'input' | 'embedding' | 'template' | 'dag' | 'response';
const PIPELINE: { id: NodeId; label: string }[] = [
  { id: 'input',     label: 'CUSTOMER MESSAGE' },
  { id: 'embedding', label: 'EMBEDDING SEARCH' },
  { id: 'template',  label: 'TEMPLATE MATCH' },
  { id: 'dag',       label: 'DAG EXECUTION' },
  { id: 'response',  label: 'RESPONSE' },
];

// Right column — comparison (top) + result (bottom)
const TABLE  = { x: 370, y: 40,  w: 550, h: 360 };
const RESULT = { x: 370, y: 420, w: 550, h: 208 };

// Aggregate across the full benchmark run (see BENCHMARK_STATS).
const fmtMs = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
const fmtTok = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}K`;
const TABLE_ROWS = [
  { label: 'avg latency', p1: fmtMs(BENCHMARK_STATS.avgLatWithoutMs), p3: fmtMs(BENCHMARK_STATS.avgLatWithMs) },
  { label: 'total cost',  p1: `$${BENCHMARK_STATS.totalCostWithout.toFixed(2)}`, p3: `$${BENCHMARK_STATS.totalCostWith.toFixed(2)}` },
  { label: 'total tokens', p1: fmtTok(BENCHMARK_STATS.totalTokensWithout), p3: fmtTok(BENCHMARK_STATS.totalTokensWith) },
  { label: 'memory hits', p1: '0', p3: `${BENCHMARK_STATS.memoryHits} / ${BENCHMARK_STATS.totalQueries}` },
];

// Mini DAG inside DAG node — compact diamond on the left side of body
const MINI_W = 22;
const MINI_H = 16;
// dx/dy relative to DAG node top-left
const MINI_POSITIONS = [
  { dx: 50, dy: 46 }, // top
  { dx: 22, dy: 70 }, // left
  { dx: 78, dy: 70 }, // right
  { dx: 50, dy: 94 }, // bottom
];
const MINI_EDGES = [[0, 1], [0, 2], [1, 3], [2, 3]];

export function Phase3Slide({ active, onNarrate }: SlideProps) {
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [nodeStatus, setNodeStatus] = useState<Record<NodeId, NodeStatus>>({
    input: 'idle', embedding: 'idle', template: 'idle', dag: 'idle', response: 'idle',
  });
  const [visibleNodes, setVisibleNodes] = useState<Set<NodeId>>(new Set());
  const [visibleEdges, setVisibleEdges] = useState<Set<number>>(new Set());
  const [dagLit, setDagLit] = useState<Set<number>>(new Set());
  const [similarityFill, setSimilarityFill] = useState(0);
  const [tableVisible, setTableVisible] = useState(false);
  const [tableRows, setTableRows] = useState(0);
  const [resultVisible, setResultVisible] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rafRef = useRef<number[]>([]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
  }, []);

  const showNode = useCallback((id: NodeId, status: NodeStatus) => {
    setVisibleNodes(prev => new Set(prev).add(id));
    setNodeStatus(prev => ({ ...prev, [id]: status }));
  }, []);

  const setStatus = useCallback((id: NodeId, status: NodeStatus) => {
    setNodeStatus(prev => ({ ...prev, [id]: status }));
  }, []);

  const showEdge = useCallback((idx: number) => {
    setVisibleEdges(prev => new Set(prev).add(idx));
  }, []);

  const animateSimilarity = useCallback((target = 0.94, duration = 600) => {
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setSimilarityFill(target * eased);
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
      setNodeStatus({
        input: 'idle', embedding: 'idle', template: 'idle', dag: 'idle', response: 'idle',
      });
      setVisibleNodes(new Set());
      setVisibleEdges(new Set());
      setDagLit(new Set());
      setSimilarityFill(0);
      setTableVisible(false);
      setTableRows(0);
      setResultVisible(false);
      return;
    }

    setPhase('running');
    onNarrate('Same request, different path. Pattern matched — no LLM needed.');

    schedule(() => showNode('input', 'done'), 300);
    schedule(() => showEdge(0), 550);
    schedule(() => {
      showNode('embedding', 'active');
      animateSimilarity();
    }, 700);
    schedule(() => setStatus('embedding', 'done'), 1300);

    schedule(() => onNarrate('Embedding lookup: 5ms. Template matched.'), 1400);
    schedule(() => showEdge(1), 1550);
    schedule(() => showNode('template', 'done'), 1700);

    schedule(() => showEdge(2), 1950);
    schedule(() => showNode('dag', 'active'), 2100);
    schedule(() => setDagLit(new Set([0])), 2200);
    schedule(() => setDagLit(new Set([0, 1])), 2320);
    schedule(() => setDagLit(new Set([0, 1, 2])), 2440);
    schedule(() => {
      setDagLit(new Set([0, 1, 2, 3]));
      setStatus('dag', 'done');
    }, 2560);

    schedule(() => onNarrate('DAG executed deterministically. No LLM involved.'), 2750);
    schedule(() => showEdge(3), 2850);
    schedule(() => showNode('response', 'done'), 3000);

    schedule(() => setTableVisible(true), 3300);
    TABLE_ROWS.forEach((_, i) => {
      schedule(() => setTableRows(i + 1), 3450 + i * 180);
    });
    schedule(() => setResultVisible(true), 4300);
    schedule(() => setPhase('done'), 4600);

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      rafRef.current.forEach(cancelAnimationFrame);
      rafRef.current = [];
    };
  }, [active]);

  const interactive = phase === 'done';

  // ── Body renderers ──────────────────────────────────────────────
  const renderInputBody = (i: number) => {
    const nodeY = pipeY(i);
    const x = PIPE_X + 16;
    const w = PIPE_W - 32;
    const y = nodeY + HEADER_H + 24;
    return (
      <g>
        <text x={x} y={y} fontSize={14}
              fontFamily="'Geist', sans-serif" fontStyle="italic" fill="#1a1a1a">
          {makeQuery('cancel_order', 790)}
        </text>
        <line x1={x} y1={y + 14} x2={x + w} y2={y + 14}
              stroke={DIVIDER_COLOR} strokeWidth={1} />
        <text x={x} y={y + 34} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}
              letterSpacing={0.5}>
          11:47
        </text>
        <text x={x + w} y={y + 34} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}
              textAnchor="end">
          user_94
        </text>
      </g>
    );
  };

  const renderEmbeddingBody = (i: number) => {
    const nodeY = pipeY(i);
    const x = PIPE_X + 16;
    const w = PIPE_W - 32;
    const y = nodeY + HEADER_H + 22;
    return (
      <g>
        <text x={x} y={y} fontSize={12}
              fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}>
          similarity
        </text>
        <text x={x + w} y={y} fontSize={13}
              fontFamily="'Geist Mono', monospace" fill="#1a1a1a" textAnchor="end">
          {similarityFill.toFixed(2)}
        </text>
        <rect x={x} y={y + 8} width={w} height={5} rx={2.5} fill={DIVIDER_COLOR} />
        <rect x={x} y={y + 8} width={w * similarityFill} height={5} rx={2.5} fill="#1a1a1a" />
        <text x={x} y={y + 36} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}>
          lookup
        </text>
        <text x={x + w * 0.55} y={y + 36} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill="#1a1a1a" textAnchor="end">
          5ms
        </text>
        <text x={x + w * 0.6} y={y + 36} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}>
          index
        </text>
        <text x={x + w} y={y + 36} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill="#1a1a1a" textAnchor="end">
          HNSW
        </text>
      </g>
    );
  };

  const renderTemplateBody = (i: number) => {
    const nodeY = pipeY(i);
    const x = PIPE_X + 16;
    const w = PIPE_W - 32;
    const y = nodeY + HEADER_H + 24;
    return (
      <g>
        <text x={x} y={y} fontSize={14}
              fontFamily="'Geist Mono', monospace" fontWeight={600} fill="#1a1a1a">
          cancel_order
        </text>
        <text x={x + w} y={y} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}
              textAnchor="end">
          v2
        </text>
        <line x1={x} y1={y + 12} x2={x + w} y2={y + 12}
              stroke={DIVIDER_COLOR} strokeWidth={1} />
        <text x={x} y={y + 32} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}>
          confidence
        </text>
        <text x={x + w * 0.55} y={y + 32} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill="#1a1a1a" textAnchor="end">
          0.97
        </text>
        <text x={x + w * 0.6} y={y + 32} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}>
          uses
        </text>
        <text x={x + w} y={y + 32} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill="#1a1a1a" textAnchor="end">
          {BENCHMARK_STATS.memoryHits}
        </text>
      </g>
    );
  };

  const renderDagBody = (i: number) => {
    const nodeY = pipeY(i);
    const textX = PIPE_X + 130;
    const textW = PIPE_W - 130 - 16;
    const textY = nodeY + HEADER_H + 26;
    return (
      <g>
        {/* Mini edges */}
        {MINI_EDGES.map(([from, to], ei) => {
          const a = MINI_POSITIONS[from];
          const b = MINI_POSITIONS[to];
          const bothLit = dagLit.has(from) && dagLit.has(to);
          return (
            <line key={`mde-${ei}`}
                  x1={PIPE_X + a.dx + MINI_W / 2} y1={nodeY + a.dy + MINI_H / 2}
                  x2={PIPE_X + b.dx + MINI_W / 2} y2={nodeY + b.dy + MINI_H / 2}
                  stroke={bothLit ? '#1a1a1a' : DIVIDER_COLOR} strokeWidth={1}
                  style={{ transition: 'stroke 0.2s' }} />
          );
        })}
        {/* Mini nodes */}
        {MINI_POSITIONS.map((p, ni) => {
          const lit = dagLit.has(ni);
          return (
            <rect key={`mdn-${ni}`}
                  x={PIPE_X + p.dx} y={nodeY + p.dy}
                  width={MINI_W} height={MINI_H} rx={3}
                  fill={lit ? '#1a1a1a' : '#f4f4f4'}
                  stroke={lit ? '#1a1a1a' : SURFACE_STROKE} strokeWidth={1}
                  style={{ transition: 'fill 0.2s, stroke 0.2s' }} />
          );
        })}
        {/* Right-side readouts */}
        <text x={textX} y={textY} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}>
          nodes
        </text>
        <text x={textX + textW} y={textY} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill="#1a1a1a" textAnchor="end">
          4
        </text>
        <text x={textX} y={textY + 20} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}>
          edges
        </text>
        <text x={textX + textW} y={textY + 20} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill="#1a1a1a" textAnchor="end">
          4
        </text>
        <text x={textX} y={textY + 46} fontSize={10}
              fontFamily="'Geist Mono', monospace" fill="#22c55e"
              letterSpacing={0.6}>
          deterministic
        </text>
      </g>
    );
  };

  const renderResponseBody = (i: number) => {
    const nodeY = pipeY(i);
    const x = PIPE_X + 16;
    const w = PIPE_W - 32;
    const colX = x + w * 0.55;
    const col2 = x + w * 0.6;
    const y = nodeY + HEADER_H + 24;
    return (
      <g>
        <text x={x} y={y} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}>
          time
        </text>
        <text x={colX} y={y} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill="#1a1a1a" textAnchor="end">
          180ms
        </text>
        <text x={col2} y={y} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}>
          cost
        </text>
        <text x={x + w} y={y} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill="#22c55e" textAnchor="end"
              className={phase === 'done' ? 'complete-pulse' : undefined}>
          $0.001
        </text>
        <line x1={x} y1={y + 14} x2={x + w} y2={y + 14}
              stroke={DIVIDER_COLOR} strokeWidth={1} />
        <text x={x} y={y + 34} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}>
          tokens
        </text>
        <text x={colX} y={y + 34} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill="#1a1a1a" textAnchor="end">
          0
        </text>
        <text x={col2} y={y + 34} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}>
          llm calls
        </text>
        <text x={x + w} y={y + 34} fontSize={11}
              fontFamily="'Geist Mono', monospace" fill="#22c55e" textAnchor="end">
          0
        </text>
      </g>
    );
  };

  const renderNodeBody = (id: NodeId, i: number) => {
    switch (id) {
      case 'input':     return renderInputBody(i);
      case 'embedding': return renderEmbeddingBody(i);
      case 'template':  return renderTemplateBody(i);
      case 'dag':       return renderDagBody(i);
      case 'response':  return renderResponseBody(i);
    }
  };

  // Vertical bezier between stacked pipeline nodes
  const pipeEdgePath = (i: number) => {
    const x = PIPE_X + PIPE_W / 2;
    const y1 = pipeY(i) + PIPE_H;
    const y2 = pipeY(i + 1);
    const mid = (y1 + y2) / 2;
    return `M${x},${y1} C${x},${mid} ${x},${mid} ${x},${y2}`;
  };

  return (
    <div className="slide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={1248} height={884} viewBox="0 0 960 680">
        {/* Pipeline edges (behind nodes) */}
        {PIPELINE.slice(0, -1).map((_, i) => (
          <path key={`pe-${i}`} d={pipeEdgePath(i)}
                className={`svg-edge${visibleEdges.has(i) ? ' visible' : ''}`}
                stroke="#ccc" strokeWidth={1.5} fill="none" />
        ))}

        {/* Pipeline nodes */}
        {PIPELINE.map((node, i) => {
          const isVisible = visibleNodes.has(node.id);
          const status = nodeStatus[node.id];
          return (
            <g key={node.id}
               className={interactive ? 'card-interactive' : undefined}
               style={{ opacity: isVisible ? 1 : 0, transition: 'opacity 0.3s ease-out' }}>
              <rect x={PIPE_X} y={pipeY(i)} width={PIPE_W} height={PIPE_H}
                    rx={8} fill={SURFACE_FILL} stroke={SURFACE_STROKE} strokeWidth={1} />
              <BoxHeader x={PIPE_X} y={pipeY(i)} w={PIPE_W}
                         label={node.label} status={status}
                         showCheck={status === 'done'} />
              {renderNodeBody(node.id, i)}
            </g>
          );
        })}

        {/* Comparison table */}
        <g className={interactive ? 'card-interactive' : undefined}
           style={{ opacity: tableVisible ? 1 : 0, transition: 'opacity 0.4s ease-out' }}>
          <rect x={TABLE.x} y={TABLE.y} width={TABLE.w} height={TABLE.h}
                rx={8} fill={SURFACE_FILL} stroke={SURFACE_STROKE} strokeWidth={1} />
          <BoxHeader x={TABLE.x} y={TABLE.y} w={TABLE.w}
                     label="PHASE 1  vs  PHASE 3"
                     status={phase === 'done' ? 'done' : 'idle'}
                     showCheck={phase === 'done'} />
          {/* Column headers */}
          <text x={TABLE.x + TABLE.w * 0.55} y={TABLE.y + HEADER_H + 26}
                fontSize={10} fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}
                textAnchor="end" letterSpacing={0.8}>
            PHASE 1
          </text>
          <text x={TABLE.x + TABLE.w - 24} y={TABLE.y + HEADER_H + 26}
                fontSize={10} fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}
                textAnchor="end" letterSpacing={0.8}>
            PHASE 3
          </text>
          <line x1={TABLE.x + 20} y1={TABLE.y + HEADER_H + 38}
                x2={TABLE.x + TABLE.w - 20} y2={TABLE.y + HEADER_H + 38}
                stroke={DIVIDER_COLOR} strokeWidth={1} />

          {/* Data rows */}
          {TABLE_ROWS.map((row, idx) => {
            const rowY = TABLE.y + HEADER_H + 72 + idx * 46;
            if (tableRows <= idx) return null;
            return (
              <g key={row.label} className="row-reveal">
                <text x={TABLE.x + 24} y={rowY} fontSize={13}
                      fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}>
                  {row.label}
                </text>
                <text x={TABLE.x + TABLE.w * 0.55} y={rowY} fontSize={14}
                      fontFamily="'Geist Mono', monospace" fill="#1a1a1a"
                      textAnchor="end">
                  {row.p1}
                </text>
                <text x={TABLE.x + TABLE.w - 24} y={rowY} fontSize={14}
                      fontFamily="'Geist Mono', monospace" fill="#22c55e"
                      fontWeight={600} textAnchor="end">
                  {row.p3}
                </text>
                {idx < TABLE_ROWS.length - 1 && (
                  <line x1={TABLE.x + 20} y1={rowY + 18}
                        x2={TABLE.x + TABLE.w - 20} y2={rowY + 18}
                        stroke={DIVIDER_COLOR} strokeWidth={1} />
                )}
              </g>
            );
          })}
        </g>

        {/* Result card */}
        <g className={interactive ? 'card-interactive' : undefined}
           style={{ opacity: resultVisible ? 1 : 0, transition: 'opacity 0.4s ease-out' }}>
          <rect x={RESULT.x} y={RESULT.y} width={RESULT.w} height={RESULT.h}
                rx={8} fill={SURFACE_FILL} stroke={SURFACE_STROKE} strokeWidth={1} />
          <BoxHeader x={RESULT.x} y={RESULT.y} w={RESULT.w}
                     label="RESULT" status={phase === 'done' ? 'done' : 'idle'}
                     showCheck={phase === 'done'} />
          {/* Hero stats */}
          <text x={RESULT.x + RESULT.w / 2} y={RESULT.y + HEADER_H + 56}
                fontSize={42} fontFamily="'Geist', sans-serif" fontWeight={700}
                fill="#1a1a1a" textAnchor="middle" letterSpacing={-1}>
            {BENCHMARK_STATS.speedup}×
          </text>
          <text x={RESULT.x + RESULT.w / 2} y={RESULT.y + HEADER_H + 78}
                fontSize={11} fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}
                textAnchor="middle" letterSpacing={0.8}>
            FASTER
          </text>
          <text x={RESULT.x + RESULT.w / 2} y={RESULT.y + HEADER_H + 128}
                fontSize={42} fontFamily="'Geist', sans-serif" fontWeight={700}
                fill="#1a1a1a" textAnchor="middle" letterSpacing={-1}>
            {BENCHMARK_STATS.costSavings}%
          </text>
          <text x={RESULT.x + RESULT.w / 2} y={RESULT.y + HEADER_H + 150}
                fontSize={11} fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}
                textAnchor="middle" letterSpacing={0.8}>
            {`CHEAPER  ·  ${BENCHMARK_STATS.tokenSavings}% TOKENS SAVED`}
          </text>
          {/* Divider + caption */}
          <line x1={RESULT.x + 24} y1={RESULT.y + HEADER_H + 180}
                x2={RESULT.x + RESULT.w - 24} y2={RESULT.y + HEADER_H + 180}
                stroke={DIVIDER_COLOR} strokeWidth={1} />
          <text x={RESULT.x + RESULT.w / 2} y={RESULT.y + HEADER_H + 210}
                fontSize={13} fontFamily="'Geist Mono', monospace" fill="#22c55e"
                textAnchor="middle" fontWeight={600}
                className={phase === 'done' ? 'complete-pulse' : undefined}>
            {`${BENCHMARK_STATS.memoryHits} of ${BENCHMARK_STATS.totalQueries} queries skipped the LLM`}
          </text>
        </g>
      </svg>
    </div>
  );
}
