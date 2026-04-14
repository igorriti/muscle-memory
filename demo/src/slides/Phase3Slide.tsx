import { useEffect, useRef, useState, useCallback } from 'react';

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

    // 5.5s
    schedule(() => onComplete(), 5500);

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [active]);

  const renderNode = (
    x: number, y: number, w: number, h: number,
    label: string, nodeId: string, bodyContent: React.ReactNode,
  ) => {
    const state = nodes[nodeId];
    if (!state?.visible) return null;
    const status = state.status;
    return (
      <g key={nodeId} className={`svg-node ${state.visible ? 'visible' : ''}`} style={{ animationDelay: '0s' }}>
        <rect x={x} y={y} width={w} height={h} rx={6} fill="#fff" stroke="#eaeaea" strokeWidth={1} />
        <rect x={x} y={y} width={w} height={24} rx={6} fill="#1a1a1a" />
        <rect x={x} y={y + 18} width={w} height={6} fill="#1a1a1a" />
        <circle cx={x + 14} cy={y + 12} r={3} fill={statusColor(status)} className={status === 'active' ? 'status-pulse' : ''} />
        <text x={x + 24} y={y + 16} fill="#fff" fontSize={10} fontFamily="'Geist Mono', monospace" style={{ textTransform: 'uppercase' } as any}>{label}</text>
        {status === 'done' && (
          <text x={x + w - 14} y={y + 13} fontSize={10} fill="#22c55e" fontFamily="'Geist Mono', monospace">&#10003;</text>
        )}
        {bodyContent}
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
      { x: bx + 80, y: by + 30 },  // top
      { x: bx + 60, y: by + 48 },  // left
      { x: bx + 100, y: by + 48 }, // right
      { x: bx + 80, y: by + 66 },  // bottom
    ];
    const miniEdges = [
      [0, 1], [0, 2], [1, 3], [2, 3],
    ];
    return (
      <g>
        {miniEdges.map(([from, to], i) => (
          <line
            key={`mini-e-${i}`}
            x1={miniNodes[from].x + 10}
            y1={miniNodes[from].y + 7}
            x2={miniNodes[to].x + 10}
            y2={miniNodes[to].y + 7}
            stroke="#ccc"
            strokeWidth={1}
          />
        ))}
        {miniNodes.map((n, i) => (
          <rect
            key={`mini-n-${i}`}
            x={n.x}
            y={n.y}
            width={20}
            height={14}
            rx={3}
            fill={dagLit.has(i) ? '#22c55e' : '#eaeaea'}
            style={{ transition: 'fill 0.1s' }}
          />
        ))}
      </g>
    );
  };

  const cx = 130; // x position for all nodes
  const nw = 180; // node width

  return (
    <div className="slide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 64, alignItems: 'flex-start', paddingTop: 96 }}>
        {/* Left: SVG Diagram */}
        <svg width={440} height={480} viewBox="0 0 440 480">
          {/* Edges */}
          {renderEdge('e-input-embed', cx + nw / 2, 80, cx + nw / 2, 110)}
          {renderEdge('e-embed-template', cx + nw / 2, 170, cx + nw / 2, 200)}
          {renderEdge('e-template-dag', cx + nw / 2, 260, cx + nw / 2, 290)}
          {renderEdge('e-dag-response', cx + nw / 2, 380, cx + nw / 2, 400)}

          {/* Input */}
          {renderNode(cx, 20, nw, 60, 'Input', 'input',
            <text x={cx + 10} y={y(20, 44)} fill="#666" fontSize={11} fontFamily="'Geist Mono', monospace">Cancel order ORD-789</text>
          )}

          {/* Embedding Search */}
          {renderNode(cx, 110, nw, 60, 'Embedding Search', 'embedding',
            <g>
              <text x={cx + 10} y={y(110, 44)} fill="#666" fontSize={11} fontFamily="'Geist Mono', monospace">similarity: 0.94</text>
              <rect x={cx + 130} y={y(110, 40)} width={36} height={6} rx={3} fill="#eaeaea" />
              <rect x={cx + 130} y={y(110, 40)} width={34} height={6} rx={3} fill="#22c55e" />
            </g>
          )}

          {/* Template Match */}
          {renderNode(cx, 200, nw, 60, 'Template Match', 'template',
            <g>
              <text x={cx + 10} y={y(200, 40)} fill="#666" fontSize={11} fontFamily="'Geist Mono', monospace">cancel_order</text>
              <text x={cx + 10} y={y(200, 54)} fill="#22c55e" fontSize={10} fontFamily="'Geist Mono', monospace">conf: 0.97</text>
            </g>
          )}

          {/* DAG Execution */}
          {renderNode(cx, 290, nw, 90, 'DAG Execution', 'dag',
            renderMiniDag(cx, 290)
          )}

          {/* Response */}
          {renderNode(cx, 400, nw, 60, 'Response', 'response',
            <text x={cx + 10} y={y(400, 44)} fill="#22c55e" fontSize={11} fontFamily="'Geist Mono', monospace" fontWeight={600}>180ms -- $0.001</text>
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
