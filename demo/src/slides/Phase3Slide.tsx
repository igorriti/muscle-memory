import { useEffect, useRef, useState, useCallback } from 'react';
import { NODE_STYLES, HEADER_COLOR, HEADER_H, type NodeCategory } from '../nodeStyles';

interface SlideProps {
  active: boolean;
  onComplete: () => void;
  onNarrate: (text: string) => void;
}

type NodeStatus = 'idle' | 'active' | 'done';

interface NodeState {
  visible: boolean;
  status: NodeStatus;
}

const INITIAL: Record<string, NodeState> = {
  input: { visible: false, status: 'idle' },
  embedding: { visible: false, status: 'idle' },
  template: { visible: false, status: 'idle' },
  dag: { visible: false, status: 'idle' },
  response: { visible: false, status: 'idle' },
};

const EDGES = ['e-input-embed', 'e-embed-template', 'e-template-dag', 'e-dag-response'];

function statusColor(status: NodeStatus): string {
  if (status === 'active') return '#eab308';
  if (status === 'done') return '#22c55e';
  return '#999';
}

export function Phase3Slide({ active, onComplete, onNarrate }: SlideProps) {
  const [nodes, setNodes] = useState<Record<string, NodeState>>({ ...INITIAL });
  const [visibleEdges, setVisibleEdges] = useState<Set<string>>(new Set());
  const [dagLit, setDagLit] = useState<Set<number>>(new Set());
  const [showTable, setShowTable] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
    return t;
  }, []);

  const showNode = useCallback((id: string, status: NodeStatus) => {
    setNodes(prev => ({ ...prev, [id]: { visible: true, status } }));
  }, []);

  const showEdge = useCallback((id: string) => {
    setVisibleEdges(prev => new Set(prev).add(id));
  }, []);

  useEffect(() => {
    if (!active) {
      setNodes({ ...INITIAL });
      setVisibleEdges(new Set());
      setDagLit(new Set());
      setShowTable(false);
      setShowSummary(false);
      return;
    }

    // 0.0s
    onNarrate('Same request, different path. Pattern matched -- no LLM needed.');

    // 0.3s - Input node
    schedule(() => showNode('input', 'done'), 300);

    // 0.5s - Edge
    schedule(() => showEdge('e-input-embed'), 500);

    // 0.6s - Embedding Search
    schedule(() => showNode('embedding', 'done'), 600);

    // 0.8s
    schedule(() => onNarrate('Embedding lookup: 5ms. Template matched.'), 800);

    // 0.9s - Edge
    schedule(() => showEdge('e-embed-template'), 900);

    // 1.0s - Template Match
    schedule(() => showNode('template', 'done'), 1000);

    // 1.2s - Edge
    schedule(() => showEdge('e-template-dag'), 1200);

    // 1.3s - DAG Execution
    schedule(() => showNode('dag', 'active'), 1300);
    schedule(() => setDagLit(new Set([0])), 1350);
    schedule(() => setDagLit(new Set([0, 1])), 1400);
    schedule(() => setDagLit(new Set([0, 1, 2])), 1450);
    schedule(() => {
      setDagLit(new Set([0, 1, 2, 3]));
      setNodes(prev => ({ ...prev, dag: { visible: true, status: 'done' } }));
    }, 1500);

    // 1.6s
    schedule(() => onNarrate('DAG executed deterministically. No LLM involved.'), 1600);

    // 1.8s - Edge
    schedule(() => showEdge('e-dag-response'), 1800);

    // 1.9s - Response
    schedule(() => showNode('response', 'done'), 1900);

    // 2.2s - Table
    schedule(() => setShowTable(true), 2200);

    // 3.0s - Summary
    schedule(() => setShowSummary(true), 3000);

    // 5.0s
    schedule(() => onNarrate(''), 5000);

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [active]);

  const renderNode = (
    x: number, y: number, w: number, h: number,
    label: string, nodeId: string, bodyContent: React.ReactNode, category: NodeCategory,
  ) => {
    const state = nodes[nodeId];
    if (!state?.visible) return null;
    const status = state.status;
    const style = NODE_STYLES[category];
    return (
      <g key={nodeId} className={`svg-node ${state.visible ? 'visible' : ''}`} style={{ animationDelay: '0s' }}>
        {/* Container */}
        <rect x={x} y={y} width={w} height={h} rx={style.rx}
              fill={style.bodyFill} stroke={style.bodyStroke} strokeWidth={1}
              strokeDasharray={style.bodyStrokeDash || undefined} />
        {/* Header */}
        <rect x={x} y={y} width={w} height={HEADER_H} rx={style.rx} fill={HEADER_COLOR} />
        <rect x={x} y={y + HEADER_H - style.rx} width={w} height={style.rx} fill={HEADER_COLOR} />
        {/* Left accent bar */}
        {style.hasLeftBar && (
          <rect x={x + 1} y={y + HEADER_H} width={3} height={h - HEADER_H - 1}
                fill={style.accentColor} />
        )}
        {/* Inner border (embedding) */}
        {style.hasInnerBorder && (
          <rect x={x + 4} y={y + HEADER_H + 4} width={w - 8} height={h - HEADER_H - 8}
                rx={Math.max(style.rx - 4, 2)} fill="none" stroke="#d0d0d0" strokeWidth={1} strokeDasharray="3,3" />
        )}
        {/* Status light */}
        <circle cx={x + 14} cy={y + 15} r={4}
                fill={statusColor(status)} className={status === 'active' ? 'status-pulse' : ''} />
        {/* Header text */}
        <text x={x + 24} y={y + 19} fill="#fff" fontSize={10}
              fontFamily="'Geist Mono', monospace" style={{ textTransform: 'uppercase' } as any}>
          {label}
        </text>
        {/* Checkmark */}
        {status === 'done' && (
          <text x={x + w - 16} y={y + 16} fontSize={10} fill="#22c55e"
                fontFamily="'Geist Mono', monospace">&#10003;</text>
        )}
        {/* Body content */}
        {bodyContent}
        {/* Bottom bar (response) */}
        {style.hasBottomBar && (
          <rect x={x + 2} y={y + h - 5} width={w - 4} height={4} rx={2} fill={style.accentColor} />
        )}
      </g>
    );
  };

  const renderEdge = (id: string, x1: number, y1: number, x2: number, y2: number) => {
    const isVisible = visibleEdges.has(id);
    const cy1 = y1 + (y2 - y1) * 0.4;
    const cy2 = y1 + (y2 - y1) * 0.6;
    return (
      <path
        key={id}
        d={`M${x1},${y1} C${x1},${cy1} ${x2},${cy2} ${x2},${y2}`}
        className={`svg-edge${isVisible ? ' visible' : ''}`}
        stroke="#ccc"
        strokeWidth={1.5}
        fill="none"
        style={isVisible ? { animationDuration: '0.3s' } : undefined}
      />
    );
  };

  // Mini DAG nodes for the DAG Execution body
  const renderMiniDag = (bx: number, by: number) => {
    // Diamond pattern: top, left, right, bottom
    const miniNodes = [
      { x: bx + 96, y: by + 36 },  // top
      { x: bx + 72, y: by + 58 },  // left
      { x: bx + 120, y: by + 58 }, // right
      { x: bx + 96, y: by + 80 },  // bottom
    ];
    const miniEdges = [
      [0, 1], [0, 2], [1, 3], [2, 3],
    ];
    return (
      <g>
        {miniEdges.map(([from, to], i) => (
          <line
            key={`mini-e-${i}`}
            x1={miniNodes[from].x + 12}
            y1={miniNodes[from].y + 9}
            x2={miniNodes[to].x + 12}
            y2={miniNodes[to].y + 9}
            stroke="#ccc"
            strokeWidth={1}
          />
        ))}
        {miniNodes.map((n, i) => (
          <rect
            key={`mini-n-${i}`}
            x={n.x}
            y={n.y}
            width={24}
            height={18}
            rx={3}
            fill={dagLit.has(i) ? '#22c55e' : '#eaeaea'}
            style={{ transition: 'fill 0.1s' }}
          />
        ))}
      </g>
    );
  };

  const cx = 110; // x position for all nodes
  const nw = 240; // node width

  return (
    <div className="slide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 64, alignItems: 'flex-start', paddingTop: 96 }}>
        {/* Left: SVG Diagram */}
        <svg width={480} height={600} viewBox="0 0 480 600">
          {/* Edges */}
          {renderEdge('e-input-embed', cx + nw / 2, 100, cx + nw / 2, 130)}
          {renderEdge('e-embed-template', cx + nw / 2, 210, cx + nw / 2, 240)}
          {renderEdge('e-template-dag', cx + nw / 2, 320, cx + nw / 2, 350)}
          {renderEdge('e-dag-response', cx + nw / 2, 460, cx + nw / 2, 490)}

          {/* Input */}
          {renderNode(cx, 20, nw, 80, 'Input', 'input',
            <text x={cx + 10} y={y(20, 50)} fill={NODE_STYLES.input.textFill} fontSize={13} fontFamily="'Geist Mono', monospace">Cancel order ORD-789</text>,
            'input',
          )}

          {/* Embedding Search */}
          {renderNode(cx, 130, nw, 80, 'Embedding Search', 'embedding',
            <g>
              <text x={cx + 10} y={y(130, 50)} fill={NODE_STYLES.embedding.textFill} fontSize={13} fontFamily="'Geist Mono', monospace">similarity: 0.94</text>
              <rect x={cx + 180} y={y(130, 46)} width={44} height={6} rx={3} fill="#d0d0d0" />
              <rect x={cx + 180} y={y(130, 46)} width={42} height={6} rx={3} fill="#14b8a6" />
            </g>,
            'embedding',
          )}

          {/* Template Match */}
          {renderNode(cx, 240, nw, 80, 'Template Match', 'template',
            <g>
              <text x={cx + 10} y={y(240, 50)} fill={NODE_STYLES.template.textFill} fontSize={13} fontFamily="'Geist Mono', monospace">cancel_order</text>
              <text x={cx + 10} y={y(240, 66)} fill="#eab308" fontSize={12} fontFamily="'Geist Mono', monospace">conf: 0.97</text>
            </g>,
            'template',
          )}

          {/* DAG Execution */}
          {renderNode(cx, 350, nw, 110, 'DAG Execution', 'dag',
            renderMiniDag(cx, 350),
            'dag',
          )}

          {/* Response */}
          {renderNode(cx, 490, nw, 80, 'Response', 'response',
            <text x={cx + 10} y={y(490, 50)} fill="#22c55e" fontSize={13} fontFamily="'Geist Mono', monospace" fontWeight={600}>180ms -- $0.001</text>,
            'response',
          )}
        </svg>

        {/* Right: Comparison Table + Stats */}
        <div style={{ minWidth: 340 }}>
          {showTable && (
            <div className="fade-in">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Phase 1</th>
                    <th>Phase 3</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ color: '#666' }}>Latency</td>
                    <td>4.2s</td>
                    <td style={{ color: '#22c55e', fontWeight: 600 }}>180ms</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#666' }}>Cost</td>
                    <td>$0.021</td>
                    <td style={{ color: '#22c55e', fontWeight: 600 }}>$0.001</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#666' }}>LLM calls</td>
                    <td>4</td>
                    <td style={{ color: '#22c55e', fontWeight: 600 }}>0</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#666' }}>Tokens</td>
                    <td>~2,400</td>
                    <td style={{ color: '#22c55e', fontWeight: 600 }}>0</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {showSummary && (
            <p className="fade-in" style={{ fontSize: 14, color: '#666', marginTop: 24, lineHeight: 1.6, maxWidth: 320 }}>
              The same request. 23x faster. 21x cheaper. Zero reasoning required.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Helper: body text y-offset from node top */
function y(nodeY: number, offset: number): number {
  return nodeY + offset;
}
