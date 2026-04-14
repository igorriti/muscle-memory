import { useState, useCallback } from 'react';
import { SAMPLE_QUERIES } from '../benchmarkData';

interface SlideProps {
  active: boolean;
  onComplete: () => void;
  onNarrate: (text: string) => void;
}

interface ChatEntry {
  query: string;
  text: string;
  phase: 1 | 3;
  latencyMs: number;
  costUsd: number;
  traceId: string;
}

interface Metrics {
  total: number;
  byPhase: { phase: number; c: number; avgLat: number; avgCost: number }[];
  successRate: number;
}

const SURFACE_STROKE = '#d4d4d4';
const LABEL_COLOR = '#666';
const DIVIDER_COLOR = '#e5e5e5';

const PRESETS = SAMPLE_QUERIES.map(s => s.query);

const fmtLat = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
const fmtCost = (c: number) => `$${c.toFixed(4)}`;

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
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [learningLoading, setLearningLoading] = useState(false);
  const [learnResult, setLearnResult] = useState<{ templatesCreated: number; templatesUpdated: number } | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/metrics');
      if (res.ok) setMetrics(await res.json());
    } catch {}
  }, []);

  const sendMessage = useCallback(async (message: string) => {
    if (running || !message.trim()) return;
    setRunning(true);
    setError(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Request failed');
      }

      const result = await res.json();
      setHistory(prev => [{
        query: message,
        text: result.text,
        phase: result.phase,
        latencyMs: result.latencyMs,
        costUsd: result.costUsd,
        traceId: result.traceId,
      }, ...prev]);
      await fetchMetrics();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }, [running, fetchMetrics]);

  const handleLearn = useCallback(async () => {
    setLearningLoading(true);
    try {
      const res = await fetch('/api/learn', { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        setLearnResult(result);
        await fetchMetrics();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLearningLoading(false);
    }
  }, [fetchMetrics]);

  const handleSend = () => {
    sendMessage(input);
    setInput('');
  };

  const latest = history[0];
  const disabledOpacity = running ? 0.6 : 1;

  return (
    <div className="slide" style={{ display: 'flex', flexDirection: 'column', paddingTop: 84 }}>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{
          width: 300,
          borderRight: `1px solid ${DIVIDER_COLOR}`,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          height: '100%',
          background: '#fff',
          overflow: 'hidden',
        }}>
          <SectionLabel>Request</SectionLabel>
          <input
            className="input-field"
            placeholder="Type a request..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            style={{ border: `1px solid ${SURFACE_STROKE}` }}
          />
          <button
            className="btn"
            style={{ width: '100%', opacity: disabledOpacity }}
            onClick={handleSend}
            disabled={running}
          >
            {running ? 'Running...' : 'Send'}
          </button>

          {error && (
            <div style={{ padding: 10, background: '#fef2f2', borderRadius: 8, fontSize: 12, color: '#dc2626' }}>
              {error}
            </div>
          )}

          <div style={{ height: 1, background: DIVIDER_COLOR }} />

          <SectionLabel>Quick try</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PRESETS.map(p => (
              <button
                key={p}
                className="btn-preset"
                style={{ opacity: disabledOpacity }}
                onClick={() => sendMessage(p)}
                disabled={running}
              >
                {p}
              </button>
            ))}
          </div>

          <div style={{ height: 1, background: DIVIDER_COLOR }} />

          {/* Learn button */}
          <button
            className="btn"
            style={{
              width: '100%',
              background: '#fff',
              color: '#1a1a1a',
              border: `1px solid #1a1a1a`,
            }}
            onClick={handleLearn}
            disabled={learningLoading}
          >
            {learningLoading ? 'Learning...' : 'Run learn()'}
          </button>

          {learnResult && (
            <div className="mono" style={{ fontSize: 11, color: '#22c55e' }}>
              +{learnResult.templatesCreated} created, {learnResult.templatesUpdated} updated
            </div>
          )}

          <div style={{ height: 1, background: DIVIDER_COLOR }} />

          <SectionLabel>History ({history.length})</SectionLabel>
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            {history.length === 0 && (
              <span style={{ fontSize: 11, color: '#bbb', fontFamily: "'Geist Mono', monospace" }}>
                no runs yet
              </span>
            )}
            {history.map((entry, i) => (
              <div key={i} style={{
                padding: 10,
                background: '#fff',
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
                  <span style={{
                    color: entry.phase === 3 ? '#22c55e' : '#1a1a1a',
                    fontWeight: 600,
                  }}>
                    P{entry.phase}
                  </span>
                  <span>{fmtLat(entry.latencyMs)}</span>
                  <span>{fmtCost(entry.costUsd)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, padding: 32, display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Latest result */}
          {latest ? (
            <div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'center' }}>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "'Geist Mono', monospace",
                  background: latest.phase === 3 ? '#f0fdf4' : '#f9fafb',
                  color: latest.phase === 3 ? '#22c55e' : '#666',
                  border: `1px solid ${latest.phase === 3 ? '#bbf7d0' : '#eaeaea'}`,
                }}>
                  Phase {latest.phase}{latest.phase === 3 ? ' · Muscle Memory' : ' · Full LLM'}
                </span>
                <span style={{ fontSize: 12, color: '#999', fontFamily: "'Geist Mono', monospace" }}>
                  {fmtLat(latest.latencyMs)}
                </span>
                <span style={{
                  fontSize: 12,
                  fontFamily: "'Geist Mono', monospace",
                  color: latest.phase === 3 ? '#22c55e' : '#999',
                }}>
                  {fmtCost(latest.costUsd)}
                </span>
              </div>

              <div style={{
                padding: 20,
                border: '1px solid #eaeaea',
                borderRadius: 12,
                fontSize: 14,
                lineHeight: 1.6,
              }}>
                {latest.text}
              </div>
            </div>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 8,
            }}>
              <span style={{ fontSize: 48, fontWeight: 700 }}>muscle-memory</span>
              <span style={{ color: '#999', fontSize: 14, fontFamily: "'Geist Mono', monospace" }}>
                Send a message to try it live. Pre-seeded templates are ready.
              </span>
            </div>
          )}

          {/* Metrics */}
          {metrics && metrics.total > 0 && (
            <div>
              <SectionLabel>Metrics</SectionLabel>
              <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                <div style={{ padding: 20, border: '1px solid #eaeaea', borderRadius: 12, flex: 1 }}>
                  <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "'Geist Mono', monospace" }}>
                    {metrics.total}
                  </div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>Total requests</div>
                </div>

                {metrics.byPhase.map(p => (
                  <div key={p.phase} style={{ padding: 20, border: '1px solid #eaeaea', borderRadius: 12, flex: 1 }}>
                    <div style={{
                      fontSize: 28,
                      fontWeight: 600,
                      fontFamily: "'Geist Mono', monospace",
                      color: p.phase === 3 ? '#22c55e' : '#1a1a1a',
                    }}>
                      {p.c}
                    </div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                      Phase {p.phase} ({Math.round(p.avgLat)}ms avg, ${p.avgCost.toFixed(4)} avg)
                    </div>
                  </div>
                ))}

                <div style={{ padding: 20, border: '1px solid #eaeaea', borderRadius: 12, flex: 1 }}>
                  <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "'Geist Mono', monospace", color: '#22c55e' }}>
                    {Math.round(metrics.successRate * 100)}%
                  </div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>Success rate</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
