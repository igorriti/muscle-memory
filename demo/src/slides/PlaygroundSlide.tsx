import { useState, useRef, useCallback } from 'react';
import { simulatePhase1, simulatePhase3, SimResult } from '../simulator';
import { SAMPLE_QUERIES, BENCHMARK_STATS } from '../benchmarkData';

// Per-query averages from the benchmark — used as the source of truth for all
// numbers shown in the playground (response cards, history, summary strip).
const P1_AVG_LAT_MS = BENCHMARK_STATS.avgLatWithoutMs;
const P3_AVG_LAT_MS = BENCHMARK_STATS.avgLatWithMs;
const P1_AVG_COST = BENCHMARK_STATS.totalCostWithout / BENCHMARK_STATS.totalQueries;
const P3_AVG_COST = BENCHMARK_STATS.totalCostWith / BENCHMARK_STATS.totalQueries;
const fmtLat = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
const fmtCost = (c: number) => `$${c.toFixed(3)}`;
const P1_RESP = `${fmtLat(P1_AVG_LAT_MS)} · ${fmtCost(P1_AVG_COST)}`;
const P3_RESP = `${fmtLat(P3_AVG_LAT_MS)} · ${fmtCost(P3_AVG_COST)}`;

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
}

interface ChatEntry {
  query: string;
  p1Ms: number;
  p3Ms: number;
  p1Cost: number;
  p3Cost: number;
  response: string;
}

// Shared design constants (match Phase1/Phase3/LearningSlide)
const HEADER_H = 32;
const SURFACE_FILL = '#fff';
const SURFACE_STROKE = '#d4d4d4';
const LABEL_COLOR = '#666';
const DIVIDER_COLOR = '#e5e5e5';

// Preset queries come from benchmark QUERY_PATTERNS (via SAMPLE_QUERIES).
const PRESETS = SAMPLE_QUERIES.map(s => s.query);

function statusColor(s: NodeStatus): string {
  if (s === 'active') return '#eab308';
  if (s === 'done') return '#22c55e';
  return '#bbb';
}

function renderNode(
  x: number, y: number, w: number, h: number,
  label: string, status: NodeStatus, bodyText?: string,
) {
  return (
    <g className="svg-node visible card-interactive" style={{ animationDelay: '0s' }}>
      <rect x={x} y={y} width={w} height={h} rx={8}
            fill={SURFACE_FILL} stroke={SURFACE_STROKE} strokeWidth={1} />
      {/* Header: status dot + label + divider */}
      <circle cx={x + 16} cy={y + HEADER_H / 2} r={4}
              fill={statusColor(status)}
              className={status === 'active' ? 'status-pulse' : ''} />
      <text x={x + 30} y={y + HEADER_H / 2 + 1} fontSize={12}
            fontFamily="'Geist Mono', monospace" fill={LABEL_COLOR}
            letterSpacing={0.9} dominantBaseline="middle">
        {label.toUpperCase()}
      </text>
      {status === 'done' && (
        <text x={x + w - 16} y={y + HEADER_H / 2 + 1} fontSize={13}
              fill="#22c55e" fontFamily="'Geist Mono', monospace"
              textAnchor="end" dominantBaseline="middle">
          &#10003;
        </text>
      )}
      <line x1={x + 16} y1={y + HEADER_H} x2={x + w - 16} y2={y + HEADER_H}
            stroke={DIVIDER_COLOR} strokeWidth={1} />
      {/* Body */}
      {bodyText && (
        <text x={x + 16} y={y + HEADER_H + (h - HEADER_H) / 2 + 1}
              fill="#1a1a1a" fontSize={14}
              fontFamily="'Geist Mono', monospace" dominantBaseline="middle">
          {bodyText}
        </text>
      )}
    </g>
  );
}

function renderEdge(x: number, y1: number, y2: number) {
  const cy1 = y1 + (y2 - y1) * 0.5;
  return (
    <path
      d={`M${x},${y1} C${x},${cy1} ${x},${cy1} ${x},${y2}`}
      className="svg-edge visible"
      stroke="#ccc" strokeWidth={1.5} fill="none"
    />
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{
      fontSize: 10,
      color: LABEL_COLOR,
      fontFamily: "'Geist Mono', monospace",
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      ...style,
    }}>
      {children}
    </span>
  );
}

export function PlaygroundSlide({ active: _active, onNarrate: _onNarrate }: SlideProps) {
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
    id: string, label: string, status: NodeStatus, bodyText?: string,
  ) => {
    setter(prev => {
      const idx = prev.findIndex(n => n.id === id);
      const entry: NodeEntry = { id, label, status, bodyText };
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
        // Show the benchmark averages (same source used by all other slides)
        // rather than the simulator's visual-animation timings, which are tuned
        // for legibility, not accuracy.
        setChatHistory(prev => [...prev, {
          query: message,
          p1Ms: P1_AVG_LAT_MS,
          p3Ms: P3_AVG_LAT_MS,
          p1Cost: P1_AVG_COST,
          p3Cost: P3_AVG_COST,
          response: p3Result!.response,
        }]);
        setRunning(false);
      }
    };

    simulatePhase1(message, (stepId, status, data) => {
      if (currentRun !== runIdRef.current) return;
      const name = data?.name as string | undefined;
      if (stepId === 'intent') {
        upsertNode(setP1Nodes, 'intent', 'Intent Analysis', status, status === 'done' ? 'intent: order_cancellation' : 'analyzing...');
      } else if (stepId === 'reasoning') {
        upsertNode(setP1Nodes, 'reasoning', 'LLM Reasoning', status, status === 'done' ? 'plan generated' : 'reasoning...');
      } else if (stepId.startsWith('tool_')) {
        upsertNode(setP1Nodes, stepId, name || stepId, status, status === 'done' ? 'ok' : 'executing...');
      } else if (stepId === 'response') {
        upsertNode(setP1Nodes, 'response', 'Response', status, status === 'done' ? P1_RESP : 'generating...');
      }
    }).then(result => {
      p1Result = result;
      p1Done = true;
      checkComplete();
    });

    simulatePhase3(message, (stepId, status, data) => {
      if (currentRun !== runIdRef.current) return;
      const name = data?.name as string | undefined;
      if (stepId === 'embedding') {
        upsertNode(setP3Nodes, 'embedding', 'Embedding Search', status,
          `similarity: ${data?.similarity ?? '0.94'}`);
      } else if (stepId === 'template') {
        upsertNode(setP3Nodes, 'template', 'Template Match', status,
          `${data?.name ?? 'match'} (${data?.confidence ?? '0.97'})`);
      } else if (stepId === 'extraction') {
        upsertNode(setP3Nodes, 'extraction', 'Arg Extraction', status,
          status === 'done' ? `order_id: ${data?.order_id ?? 'ORD-412'}` : 'extracting...');
      } else if (stepId.startsWith('tool_')) {
        upsertNode(setP3Nodes, stepId, name || stepId, status, status === 'done' ? 'ok' : 'exec...');
      } else if (stepId === 'response') {
        upsertNode(setP3Nodes, 'response', 'Response', status, P3_RESP);
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

  const renderCanvas = (nodes: NodeEntry[], label: string, isLeft: boolean) => {
    const nw = 360;
    const nh = 72;
    const gap = 14;
    const startY = 14;
    const cx = 20;

    const count = Math.max(nodes.length, 1);
    const svgHeight = count * (nh + gap) + startY + 12;

    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        borderRight: isLeft ? `1px solid ${DIVIDER_COLOR}` : undefined,
        overflow: 'hidden',
        minWidth: 0,
      }}>
        <div style={{
          padding: '10px 16px',
          borderBottom: `1px solid ${DIVIDER_COLOR}`,
          fontFamily: "'Geist Mono', monospace",
          fontSize: 11,
          color: LABEL_COLOR,
          letterSpacing: 0.6,
          flexShrink: 0,
        }}>
          {label}
        </div>
        <div style={{
          flex: 1,
          padding: 12,
          background: '#fafafa',
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}>
          {nodes.length === 0 ? (
            <div className="canvas-placeholder">Send a message to start</div>
          ) : (
            <svg width={nw + 40} height={svgHeight}
                 viewBox={`0 0 ${nw + 40} ${svgHeight}`}>
              {nodes.map((node, i) => {
                const ny = startY + i * (nh + gap);
                return (
                  <g key={node.id}>
                    {i > 0 && renderEdge(cx + nw / 2, ny - gap, ny)}
                    {renderNode(cx, ny, nw, nh, node.label, node.status, node.bodyText)}
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>
    );
  };

  const disabledOpacity = running ? 0.6 : 1;

  return (
    <div className="slide" style={{ display: 'flex', flexDirection: 'column', paddingTop: 84 }}>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{
          width: 280,
          borderRight: `1px solid ${DIVIDER_COLOR}`,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          height: '100%',
          background: SURFACE_FILL,
          overflow: 'hidden',
        }}>
          <SectionLabel>Request</SectionLabel>
          <input
            className="input-field"
            placeholder="Type a request..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ border: `1px solid ${SURFACE_STROKE}` }}
          />
          <button className="btn" style={{ width: '100%', opacity: disabledOpacity }} onClick={handleSend} disabled={running}>
            {running ? 'Running…' : 'Send'}
          </button>

          <div style={{ height: 1, background: DIVIDER_COLOR, margin: '4px 0' }} />

          <SectionLabel>Quick try</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PRESETS.map(p => (
              <button key={p} className="btn-preset" style={{ opacity: disabledOpacity }} onClick={() => runQuery(p)} disabled={running}>
                {p}
              </button>
            ))}
          </div>

          <div style={{ height: 1, background: DIVIDER_COLOR, margin: '4px 0' }} />

          <SectionLabel>History</SectionLabel>
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            {chatHistory.length === 0 && (
              <span style={{ fontSize: 11, color: '#bbb', fontFamily: "'Geist Mono', monospace" }}>
                no runs yet
              </span>
            )}
            {chatHistory.map((entry, i) => (
              <div key={i} style={{
                padding: 10,
                background: SURFACE_FILL,
                border: `1px solid ${SURFACE_STROKE}`,
                borderRadius: 6,
              }}>
                <div style={{ fontSize: 12, marginBottom: 6, color: '#1a1a1a' }}>
                  {entry.query}
                </div>
                <div style={{
                  display: 'flex',
                  gap: 10,
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 10,
                  color: LABEL_COLOR,
                }}>
                  <span>P1 {fmtLat(entry.p1Ms)}</span>
                  <span>P3 {fmtLat(entry.p3Ms)}</span>
                  <span style={{ color: '#22c55e' }}>{fmtCost(entry.p3Cost)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main area */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: SURFACE_FILL,
          minWidth: 0,
          overflow: 'hidden',
        }}>
          {/* Canvas panels */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
            {renderCanvas(p1Nodes, 'PHASE 1  ·  FULL LLM', true)}
            {renderCanvas(p3Nodes, 'PHASE 3  ·  MUSCLE MEMORY', false)}
          </div>

          {/* Summary strip */}
          {showMetrics && lastResult && (
            <div className="fade-in" style={{
              borderTop: `1px solid ${DIVIDER_COLOR}`,
              padding: '16px 28px',
              display: 'flex',
              gap: 12,
              flexShrink: 0,
              background: SURFACE_FILL,
            }}>
              {/* Summary reflects the full 1000-query benchmark run, not the
                   single animated simulation above. */}
              {[
                { label: 'speedup',   value: `${BENCHMARK_STATS.speedup}× faster` },
                { label: 'savings',   value: `${BENCHMARK_STATS.costSavings}% cheaper` },
                { label: 'tokens',    value: `${BENCHMARK_STATS.tokenSavings}% saved` },
                { label: 'memory',    value: `${BENCHMARK_STATS.memoryHits}/${BENCHMARK_STATS.totalQueries} hits` },
              ].map(m => (
                <div key={m.label} style={{
                  padding: '10px 16px',
                  background: SURFACE_FILL,
                  border: `1px solid ${SURFACE_STROKE}`,
                  borderRadius: 8,
                  minWidth: 160,
                }}>
                  <div style={{
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 10,
                    color: LABEL_COLOR,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}>
                    {m.label}
                  </div>
                  <div style={{
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 16,
                    fontWeight: 600,
                    color: '#22c55e',
                  }}>
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
