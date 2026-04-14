import { useEffect } from 'react';

export function HeroSlide({ active, onComplete, onNarrate }: {
  active: boolean;
  onComplete: () => void;
  onNarrate: (text: string) => void;
}) {
  useEffect(() => {
    if (!active) return;
    onNarrate('');
  }, [active]);

  return (
    <div className="slide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img className="fade-in" src="/muscle.jpeg" alt="Muscle Memory" style={{ width: 96, height: 96, borderRadius: 16, marginBottom: 16 }} />
        <h1 className="fade-in" style={{ fontSize: 72, fontWeight: 700, letterSpacing: -2, margin: 0, lineHeight: 1, animationDelay: '0.1s' }}>Muscle Memory</h1>
        <p className="fade-in" style={{ fontSize: 24, color: '#999', fontWeight: 400, margin: '8px 0 0', animationDelay: '0.2s' }}>agents that learn</p>
        <p className="fade-in" style={{ fontSize: 16, color: '#666', maxWidth: 480, margin: '32px 0 0', lineHeight: 1.6, animationDelay: '0.5s' }}>
          From full LLM reasoning to deterministic execution.<br />A self-optimizing agent architecture.
        </p>
        <div className="fade-in" style={{ display: 'flex', gap: 16, marginTop: 48, animationDelay: '0.8s' }}>
          {['20x faster', '20x cheaper', '0 LLM calls'].map(s => (
            <span key={s} style={{ border: '1px solid #eaeaea', borderRadius: 20, padding: '6px 16px', fontFamily: "'Geist Mono', monospace", fontSize: 12 }}>{s}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
