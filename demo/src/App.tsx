import { useState, useCallback } from 'react';
import { HeroSlide } from './slides/HeroSlide';
import { Phase1Slide } from './slides/Phase1Slide';
import { LearningSlide } from './slides/LearningSlide';
import { Phase3Slide } from './slides/Phase3Slide';
import { PlaygroundSlide } from './slides/PlaygroundSlide';

const SLIDE_LABELS = [
  'agents that learn',
  'Phase 1 -- Full LLM',
  'Phase 2 -- Pattern Detection',
  'Phase 3 -- Muscle Memory',
  'Interactive Demo',
];

const TOTAL_SLIDES = 5;

export function App() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [narration, setNarration] = useState('');

  const goToNext = useCallback(() => {
    setCurrentSlide(s => Math.min(s + 1, TOTAL_SLIDES - 1));
  }, []);

  return (
    <>
      {/* Header */}
      <header className="header" style={{ position: 'fixed', top: 0, zIndex: 100, width: '100%', background: 'white', borderBottom: '1px solid #eaeaea', height: 48, display: 'flex', alignItems: 'center', padding: '0 24px' }}>
        <span className="header-logo">aig</span>
        <span className="header-label" style={{ color: '#999', fontSize: 13, marginLeft: 16, fontFamily: "'Geist Mono', monospace" }}>
          {SLIDE_LABELS[currentSlide]}
        </span>
        {/* Slide dots */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {Array.from({ length: TOTAL_SLIDES }, (_, i) => (
            <div
              key={i}
              onClick={() => setCurrentSlide(i)}
              style={{
                width: 6, height: 6, borderRadius: '50%',
                background: i === currentSlide ? '#1a1a1a' : '#ccc',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      </header>

      {/* Narration bar */}
      <div className="narration-bar" style={{
        position: 'fixed', top: 48, zIndex: 99, width: '100%',
        background: '#fafafa', borderBottom: '1px solid #eaeaea',
        padding: '10px 24px', fontFamily: "'Geist Mono', monospace",
        fontSize: 12, color: '#666', minHeight: 36,
        opacity: narration ? 1 : 0, transition: 'opacity 0.3s',
      }}>
        {narration}
      </div>

      {/* Slides container */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: `translateY(${-currentSlide * 100}vh)`,
      }}>
        <HeroSlide active={currentSlide === 0} onComplete={goToNext} onNarrate={setNarration} />
        <Phase1Slide active={currentSlide === 1} onComplete={goToNext} onNarrate={setNarration} />
        <LearningSlide active={currentSlide === 2} onComplete={goToNext} onNarrate={setNarration} />
        <Phase3Slide active={currentSlide === 3} onComplete={goToNext} onNarrate={setNarration} />
        <PlaygroundSlide active={currentSlide === 4} onComplete={() => {}} onNarrate={setNarration} />
      </div>
    </>
  );
}
