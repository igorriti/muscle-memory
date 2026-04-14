// ── Primary API ──
export { muscleMemory } from './muscle-memory.js';
export type { MuscleMemoryConfig } from './muscle-memory.js';

// ── Stores ──
export { SqliteStore } from './store.js';
export type { Store } from './types.js';

// ── Alternative wrapper API ──
export { withMemory, learn } from './with-memory.js';
export type { MemoryOptions, LearnOptions, MithrilMeta } from './with-memory.js';

// ── Types ──
export type {
  MithrilConfig,
  ToolDefinition,
  ToolRegistry,
  Template,
  Trace,
  TraceStep,
  ExecutionGraph,
  GraphNode,
  GraphEdge,
  ArgField,
} from './types.js';
export { DEFAULT_CONFIG } from './types.js';
