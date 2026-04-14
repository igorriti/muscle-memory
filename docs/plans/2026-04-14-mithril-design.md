# Mithril: Agents That Learn -- Implementation Plan

## Architecture

Two packages in one repo:

```
muscle-memory/
├── package.json              # Mithril library (TypeScript, better-sqlite3)
├── tsconfig.json
├── src/                      # Library source
│   ├── index.ts
│   ├── mithril.ts            # Router/orchestrator
│   ├── agent.ts              # Phase 1: AI SDK agent wrapper
│   ├── tracer.ts             # Trace persistence + async embeddings
│   ├── store.ts              # SQLite storage (better-sqlite3)
│   ├── types.ts              # All shared types
│   ├── learner/
│   │   └── pipeline.ts       # Batch learning: cluster → extract graph → template
│   └── executor/
│       ├── intent-matcher.ts  # Keyword + embedding similarity matching
│       ├── arg-extractor.ts   # Regex-first, SLM fallback extraction
│       ├── graph-walker.ts    # Deterministic DAG executor
│       └── condition-eval.ts  # Safe expression evaluator (no eval())
├── demo/                     # React demo app (Vite)
│   ├── package.json
│   ├── index.html
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx            # Slide manager + scroll transitions
│       ├── styles.css         # Global styles, animations, Geist font
│       ├── simulator.ts       # Client-side pipeline simulation
│       ├── components/
│       │   ├── Header.tsx
│       │   ├── NarrationBar.tsx
│       │   ├── SVGNode.tsx    # Reusable animated node
│       │   ├── SVGEdge.tsx    # Reusable edge with draw + particle
│       │   └── ToolGrid.tsx   # 128-tool grid with flash animation
│       └── slides/
│           ├── HeroSlide.tsx       # Slide 0: Title + thesis
│           ├── Phase1Slide.tsx     # Slide 1: Full LLM flow
│           ├── LearningSlide.tsx   # Slide 2: Pattern detection
│           ├── Phase3Slide.tsx     # Slide 3: Muscle memory
│           └── PlaygroundSlide.tsx # Slide 4: Interactive demo
└── docs/
```

## Design Decisions

- **Demo is fully client-side.** Simulates both Phase 1 (~4s with animated steps) and Phase 3 (~200ms) without real LLM calls. Works without API keys.
- **Library uses Vercel AI SDK** (v6), better-sqlite3 for storage, ml-distance for cosine similarity.
- **Demo uses Vite + React** with inline SVG for all visualizations. No chart libraries.
- **Design language:** White bg, Geist/Geist Mono, no emojis, no color except black/gray/green (#22c55e for success/savings).

## Implementation Order

1. Project setup (package.json, tsconfig for both packages)
2. Library files (all provided in spec -- write verbatim)
3. Demo app structure + global styles
4. Reusable SVG components (Node, Edge, ToolGrid)
5. Slides 0-3 (animated, auto-advancing)
6. Slide 4: Interactive playground with simulation engine
7. Verify everything builds and runs
