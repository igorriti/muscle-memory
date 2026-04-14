import { useState, useRef, useCallback } from 'react';
import { simulatePhase1, simulatePhase3, TOOL_CATALOG, SimResult } from '../simulator';
import { NODE_STYLES, HEADER_COLOR, HEADER_H, type NodeCategory } from '../nodeStyles';

interface SlideProps {
  active: boolean;
  onComplete: () => void;
  onNarrate: (text: string) => void;
}

type NodeStatus = 'idle' | 'active' | 'done';

interface NodeEntry {
  id: string;
  label: string;
  status: NodeStatus;
  bodyText?: string;
  category: NodeCategory;
}

interface ChatEntry {
  query: string;
  p1Ms: number;
  p3Ms: number;
  p1Cost: number;
  p3Cost: number;
  response: string;
}

const PRESETS = [
  'Cancel order ORD-412',
  'Where is my shipment 1337?',
  'Payment issue on order ORD-412',
  'Return item from order ORD-891',
];

function renderNode(
  x: number, y: number, w: number, h: number,
  label: string, status: NodeStatus, visible: boolean, bodyText?: string, category: NodeCategory = 'tool',
) {
  if (!visible) return null;
  const style = NODE_STYLES[category];
  return (
    <g className={`svg-node ${visible ? 'visible' : ''}`} style={{ animationDelay: '0s' }}>
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
      <circle
        cx={x + 14} cy={y + HEADER_H / 2} r={4}
        fill={status === 'done' ? '#22c55e' : status === 'active' ? '#eab308' : '#999'}
        className={status === 'active' ? 'status-pulse' : ''}
      />
      {/* Header text */}
      <text x={x + 24} y={y + HEADER_H / 2 + 1} fill="white" fontSize={10}
            fontFamily="'Geist Mono', monospace" dominantBaseline="middle"
            style={{ textTransform: 'uppercase' } as any}>
        {label}
      </text>
      {/* Body text */}
      {bodyText && (
        <text x={x + 10} y={y + HEADER_H + (h - HEADER_H) / 2 + 1} fill={style.textFill} fontSize={12}
              fontFamily="'Geist Mono', monospace" dominantBaseline="middle">
          {bodyText}
        </text>
      )}
      {/* Bottom bar (response) */}
      {style.hasBottomBar && (
        <rect x={x + 2} y={y + h - 5} width={w - 4} height={4} rx={2} fill={style.accentColor} />
      )}
    </g>
  );
}

function renderEdge(x: number, y1: number, y2: number, visible: boolean) {
  if (!visible) return null;
  const cy1 = y1 + (y2 - y1) * 0.4;
  const cy2 = y1 + (y2 - y1) * 0.6;
  return (
    <path
      d={`M${x},${y1} C${x},${cy1} ${x},${cy2} ${x},${y2}`}
      className={`svg-edge${visible ? ' visible' : ''}`}
      stroke="#ccc" strokeWidth={1.5} fill="none"
    />
  );
}

export function PlaygroundSlide({ active, onNarrate }: SlideProps) {
  const [input, setInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const [p1Nodes, setP1Nodes] = useState<NodeEntry[]>([]);
  const [p3Nodes, setP3Nodes] = useState<NodeEntry[]>([]);
  const [showMetrics, setShowMetrics] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<{ p1: SimResult; p3: SimResult } | null>(null);
  const runIdRef = useRef(0);

  const upsertNode = useCallback((
    setter: React.Dispatch<React.SetStateAction<NodeEntry[]>>,
    id: string, label: string, status: NodeStatus, bodyText?: string, category: NodeCategory = 'tool',
  ) => {
    setter(prev => {
      const idx = prev.findIndex(n => n.id === id);
      const entry: NodeEntry = { id, label, status, bodyText, category };
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = entry;
        return next;
      }
      return [...prev, entry];
    });
  }, []);

  const runQuery = useCallback((message: string) => {
    if (running || !message.trim()) return;
    setRunning(true);
    setP1Nodes([]);
    setP3Nodes([]);
    setShowMetrics(false);
    setLastResult(null);

    const currentRun = ++runIdRef.current;
    let p1Done = false;
    let p3Done = false;
    let p1Result: SimResult | null = null;
    let p3Result: SimResult | null = null;

    const checkComplete = () => {
      if (p1Done && p3Done && p1Result && p3Result && currentRun === runIdRef.current) {
        setLastResult({ p1: p1Result, p3: p3Result });
        setShowMetrics(true);
        setChatHistory(prev => [...prev, {
          query: message,
          p1Ms: p1Result!.totalMs,
          p3Ms: p3Result!.totalMs,
          p1Cost: p1Result!.cost,
          p3Cost: p3Result!.cost,
          response: p3Result!.response,
        }]);
        setRunning(false);
      }
    };

    // Phase 1
    simulatePhase1(message, (stepId, status, data) => {
      if (currentRun !== runIdRef.current) return;
      const name = data?.name as string | undefined;
      if (stepId === 'intent') {
        upsertNode(setP1Nodes, 'intent', 'Intent Analysis', status, status === 'done' ? 'intent: order_cancellation' : 'Analyzing...', 'reasoning');
      } else if (stepId === 'reasoning') {
        upsertNode(setP1Nodes, 'reasoning', 'LLM Reasoning', status, status === 'done' ? 'Plan generated' : 'Reasoning...', 'reasoning');
      } else if (stepId.startsWith('tool_')) {
        upsertNode(setP1Nodes, stepId, name || stepId, status, status === 'done' ? 'ok' : 'executing...');
      } else if (stepId === 'response') {
        upsertNode(setP1Nodes, 'response', 'Response', status, status === 'done' ? '4.2s -- $0.021' : 'Generating...', 'response');
      }
    }).then(result => {
      p1Result = result;
      p1Done = true;
      checkComplete();
    });

    // Phase 3
    simulatePhase3(message, (stepId, status, data) => {
      if (currentRun !== runIdRef.current) return;
      const name = data?.name as string | undefined;
      if (stepId === 'embedding') {
        upsertNode(setP3Nodes, 'embedding', 'Embedding Search', status,
          `similarity: ${data?.similarity ?? '0.94'}`, 'embedding');
      } else if (stepId === 'template') {
        upsertNode(setP3Nodes, 'template', 'Template Match', status,
          `${data?.name ?? 'match'} (${data?.confidence ?? '0.97'})`, 'template');
      } else if (stepId === 'extraction') {
        upsertNode(setP3Nodes, 'extraction', 'Arg Extraction', status,
          status === 'done' ? `order_id: ${data?.order_id ?? 'ORD-412'}` : 'extracting...');
      } else if (stepId.startsWith('tool_')) {
        upsertNode(setP3Nodes, stepId, name || stepId, status, status === 'done' ? 'ok' : 'exec...');
      } else if (stepId === 'response') {
        upsertNode(setP3Nodes, 'response', 'Response', status, '180ms -- $0.001', 'response');
      }
    }).then(result => {
      p3Result = result;
      p3Done = true;
      checkComplete();
    });
  }, [running, upsertNode]);

  const handleSend = () => {
    runQuery(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  };

  const renderCanvas = (nodes: NodeEntry[], label: string) => {
    const nw = 200;
    const nh = 72;
    const cx = 20;
    const startY = 12;
    const gap = 16;

    if (nodes.length === 0) {
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: label.includes('1') ? '1px solid #eaeaea' : undefined }}>
          <div style={{ padding: 12, borderBottom: '1px solid #eaeaea', fontFamily: "'Geist Mono', monospace", fontSize: 11, color: '#999' }}>
            {label}
          </div>
          <div className="canvas-placeholder">Send a message to start</div>
        </div>
      );
    }

    const svgHeight = Math.max(400, nodes.length * (nh + gap) + startY + 20);

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: label.includes('1') ? '1px solid #eaeaea' : undefined, overflow: 'hidden' }}>
        <div style={{ padding: 12, borderBottom: '1px solid #eaeaea', fontFamily: "'Geist Mono', monospace", fontSize: 11, color: '#999' }}>
          {label}
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
          <svg width="100%" height={svgHeight} viewBox={`0 0 260 ${svgHeight}`}>
            {nodes.map((node, i) => {
              const ny = startY + i * (nh + gap);
              return (
                <g key={node.id}>
                  {i > 0 && renderEdge(cx + nw / 2, ny - gap, ny, true)}
                  {renderNode(cx, ny, nw, nh, node.label, node.status, true, node.bodyText, node.category)}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="slide" style={{ display: 'flex', flexDirection: 'column', paddingTop: 84 }}>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <div className="playground-sidebar">
          <input
            className="input-field"
            placeholder="Type a request..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="btn" style={{ width: '100%' }} onClick={handleSend} disabled={running}>
            Send
          </button>

          <div style={{ height: 1, background: '#eaeaea' }} />

          <span style={{ fontSize: 11, color: '#999', fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Quick try
          </span>
          {PRESETS.map(p => (
            <button key={p} className="btn-preset" onClick={() => runQuery(p)} disabled={running}>{p}</button>
          ))}

          <div style={{ height: 1, background: '#eaeaea' }} />

          <span style={{ fontSize: 11, color: '#999', fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            History
          </span>
          <div className="chat-history">
            {chatHistory.map((entry, i) => (
              <div key={i} className="chat-entry">
                <div className="chat-entry-query">{entry.query}</div>
                <div className="chat-entry-meta">
                  <span>P1: {entry.p1Ms}ms</span>
                  <span>P3: {entry.p3Ms}ms</span>
                  <span>${entry.p3Cost}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* Canvas panels */}
          <div style={{ display: 'flex', minHeight: 380, flexShrink: 0 }}>
            {renderCanvas(p1Nodes, 'PHASE 1 -- FULL LLM')}
            {renderCanvas(p3Nodes, 'PHASE 3 -- MUSCLE MEMORY')}
          </div>

          {/* Metrics section */}
          {showMetrics && lastResult && (
            <div className="fade-in" style={{ borderTop: '1px solid #eaeaea', padding: '20px 24px', overflow: 'auto' }}>
              {/* Metrics summary bar */}
              <div style={{ display: 'flex', gap: 32, marginBottom: 20 }}>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 14, color: '#22c55e', fontWeight: 600 }}>23x faster</span>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 14, color: '#22c55e', fontWeight: 600 }}>95% cheaper</span>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 14, color: '#22c55e', fontWeight: 600 }}>0 LLM calls</span>
              </div>

              {/* Enterprise Impact */}
              <div style={{ fontSize: 11, color: '#999', fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                Enterprise Impact
              </div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                <div className="stat-card" style={{ flex: 1 }}>
                  <div className="stat-value" style={{ color: '#22c55e' }}>$221K</div>
                  <div className="stat-label">Annual savings at 10K tickets/day</div>
                </div>
                <div className="stat-card" style={{ flex: 1 }}>
                  <div className="stat-value">2.37M</div>
                  <div className="stat-label">Tickets without LLM per year</div>
                </div>
                <div className="stat-card" style={{ flex: 1 }}>
                  <div className="stat-value">1.2s</div>
                  <div className="stat-label">Average response time</div>
                </div>
                <div className="stat-card" style={{ flex: 1 }}>
                  <div className="stat-value" style={{ color: '#22c55e' }}>97%</div>
                  <div className="stat-label">Cost reduction</div>
                </div>
              </div>

              {/* Cost comparison table */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                <div className="stat-card" style={{ flex: 1, textAlign: 'center' }}>
                  <div className="stat-label" style={{ marginBottom: 8, marginTop: 0 }}>Without AIG</div>
                  <div className="stat-value" style={{ color: '#dc2626' }}>$350,000</div>
                </div>
                <div className="stat-card" style={{ flex: 1, textAlign: 'center' }}>
                  <div className="stat-label" style={{ marginBottom: 8, marginTop: 0 }}>With AIG</div>
                  <div className="stat-value" style={{ color: '#1a1a1a' }}>$128,750</div>
                </div>
                <div className="stat-card" style={{ flex: 1, textAlign: 'center' }}>
                  <div className="stat-label" style={{ marginBottom: 8, marginTop: 0 }}>Savings</div>
                  <div className="stat-value" style={{ color: '#22c55e' }}>$221,250</div>
                </div>
              </div>
              <div style={{ fontSize: 11, fontFamily: "'Geist Mono', monospace", color: '#999', marginBottom: 20 }}>
                Cost at 10 million tickets per year
              </div>

              {/* 128-tool catalog */}
              <div style={{ fontSize: 11, color: '#999', fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                128-Tool Catalog
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {TOOL_CATALOG.map(tool => (
                  <span key={tool} className="tool-pill">{tool}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
