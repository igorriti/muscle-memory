'use client';

import { useState, useCallback, useEffect } from 'react';
import './globals.css';

interface ChatResult {
  text: string;
  phase: 1 | 3;
  traceId: string;
  latencyMs: number;
  costUsd: number;
}

interface Metrics {
  total: number;
  byPhase: { phase: number; c: number; avgLat: number; avgCost: number }[];
  successRate: number;
}

const PRESETS = [
  'Cancel my order ORD-412',
  'Cancel order ORD-789 please',
  'I want to cancel ORD-555',
  'Where is my shipment for order ORD-100?',
  'I need to cancel my order ORD-333',
];

export default function Home() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<(ChatResult & { query: string })[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [learnResult, setLearnResult] = useState<{ templatesCreated: number; templatesUpdated: number } | null>(null);
  const [learningLoading, setLearningLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/metrics');
      if (res.ok) setMetrics(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  const sendMessage = useCallback(async (message: string) => {
    if (loading || !message.trim()) return;
    setLoading(true);
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

      const result: ChatResult = await res.json();
      setHistory(prev => [{ ...result, query: message }, ...prev]);
      await fetchMetrics();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [loading, fetchMetrics]);

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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid #eaeaea',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 18 }}>muscle-memory</span>
          <span className="mono" style={{ color: '#999', fontSize: 12 }}>agents that learn</span>
        </div>
      </header>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex' }}>
        {/* Sidebar */}
        <div style={{
          width: 300,
          borderRight: '1px solid #eaeaea',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '1px solid #eaeaea',
              borderRadius: 8,
              fontFamily: "'Geist', sans-serif",
              fontSize: 14,
              outline: 'none',
            }}
          />

          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: loading ? '#666' : '#1a1a1a',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontFamily: "'Geist', sans-serif",
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Processing...' : 'Send'}
          </button>

          {error && (
            <div style={{ padding: 10, background: '#fef2f2', borderRadius: 8, fontSize: 12, color: '#dc2626' }}>
              {error}
            </div>
          )}

          <div style={{ height: 1, background: '#eaeaea' }} />

          <span className="mono" style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Quick try
          </span>

          {PRESETS.map(p => (
            <button
              key={p}
              onClick={() => sendMessage(p)}
              disabled={loading}
              style={{
                padding: '8px 12px',
                background: '#fff',
                border: '1px solid #eaeaea',
                borderRadius: 8,
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {p}
            </button>
          ))}

          <div style={{ height: 1, background: '#eaeaea' }} />

          {/* Learn button */}
          <button
            onClick={handleLearn}
            disabled={learningLoading}
            style={{
              padding: '10px 14px',
              background: '#fff',
              border: '1px solid #1a1a1a',
              borderRadius: 8,
              fontSize: 13,
              fontFamily: "'Geist Mono', monospace",
              cursor: 'pointer',
            }}
          >
            {learningLoading ? 'Learning...' : 'Run learn()'}
          </button>

          {learnResult && (
            <div className="mono" style={{ fontSize: 11, color: '#22c55e' }}>
              +{learnResult.templatesCreated} templates created, {learnResult.templatesUpdated} updated
            </div>
          )}

          <div style={{ height: 1, background: '#eaeaea' }} />

          {/* History */}
          <span className="mono" style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            History ({history.length})
          </span>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map((entry, i) => (
              <div key={i} style={{ padding: 10, border: '1px solid #eaeaea', borderRadius: 8, fontSize: 11 }}>
                <div style={{ marginBottom: 4 }}>{entry.query}</div>
                <div className="mono" style={{ color: '#999', display: 'flex', gap: 8 }}>
                  <span style={{ color: entry.phase === 3 ? '#22c55e' : '#1a1a1a', fontWeight: 600 }}>
                    P{entry.phase}
                  </span>
                  <span>{entry.latencyMs}ms</span>
                  <span>${entry.costUsd.toFixed(4)}</span>
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
                <span className="mono" style={{
                  padding: '4px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  background: latest.phase === 3 ? '#f0fdf4' : '#f9fafb',
                  color: latest.phase === 3 ? '#22c55e' : '#666',
                  border: `1px solid ${latest.phase === 3 ? '#bbf7d0' : '#eaeaea'}`,
                }}>
                  Phase {latest.phase}{latest.phase === 3 ? ' -- Muscle Memory' : ' -- Full LLM'}
                </span>
                <span className="mono" style={{ fontSize: 12, color: '#999' }}>
                  {latest.latencyMs}ms
                </span>
                <span className="mono" style={{ fontSize: 12, color: latest.phase === 3 ? '#22c55e' : '#999' }}>
                  ${latest.costUsd.toFixed(4)}
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
              <span className="mono" style={{ color: '#999', fontSize: 14 }}>
                Send a message to start. After 5 similar requests, run learn().
              </span>
            </div>
          )}

          {/* Metrics */}
          {metrics && metrics.total > 0 && (
            <div>
              <span className="mono" style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Metrics
              </span>

              <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                <div style={{ padding: 20, border: '1px solid #eaeaea', borderRadius: 12, flex: 1 }}>
                  <div className="mono" style={{ fontSize: 28, fontWeight: 600 }}>{metrics.total}</div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>Total requests</div>
                </div>

                {metrics.byPhase.map(p => (
                  <div key={p.phase} style={{ padding: 20, border: '1px solid #eaeaea', borderRadius: 12, flex: 1 }}>
                    <div className="mono" style={{
                      fontSize: 28,
                      fontWeight: 600,
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
                  <div className="mono" style={{ fontSize: 28, fontWeight: 600, color: '#22c55e' }}>
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
