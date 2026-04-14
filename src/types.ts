import { z } from 'zod';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType<any>;
  outputSchema: z.ZodType<any>;
  execute: (input: any) => Promise<any>;
  idempotent: boolean;
  timeoutMs: number;
  retries: number;
}

export type ToolRegistry = Record<string, ToolDefinition>;

export interface TraceStep {
  stepId: number;
  toolName: string;
  toolInput: Record<string, any>;
  toolOutput: Record<string, any>;
  latencyMs: number;
  success: boolean;
  dependsOn: number | null;
  error?: string;
}

export interface Trace {
  traceId: string;
  timestamp: string;
  userMessage: string;
  userMessageEmbedding: number[] | null;
  steps: TraceStep[];
  finalResponse: string;
  totalTokens: number;
  totalCostUsd: number;
  totalLatencyMs: number;
  success: boolean;
  phase: 1 | 2 | 3;
  templateId: string | null;
  routingReason: string;
}

export interface GraphNode {
  id: string;
  tool: string;
  argsTemplate: Record<string, string>;
}

export interface GraphEdge {
  from: string;
  to: string;
  condition: string | null;
  weight: number;
  type: 'normal' | 'fallback';
}

export interface ExecutionGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  rootNodeId: string;
}

export interface ArgField {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  description: string;
  examples: string[];
}

export interface Template {
  templateId: string;
  name: string;
  embedding: number[];
  argSchema: ArgField[];
  graph: ExecutionGraph;
  confidence: number;
  totalExecutions: number;
  successfulExecutions: number;
  createdAt: string;
  lastUsedAt: string;
  ttlDays: number;
  status: 'active' | 'degraded' | 'expired';
}

export interface MatchResult {
  templateId: string;
  similarity: number;
  matchType: 'keyword' | 'embedding';
}

export type Phase = 1 | 2 | 3;

export interface RoutingDecision {
  phase: Phase;
  reason: string;
  templateId?: string;
  similarity?: number;
  confidence?: number;
}

export interface MithrilConfig {
  plannerModel: string;
  extractorModel: string;
  embeddingModel: string;
  similarityThreshold: number;
  confidenceThreshold: number;
  ambiguousZoneLower: number;
  minTracesForTemplate: number;
  failuresToDegrade: number;
  degradeSuccessRate: number;
  ttlDays: number;
  decayPerWeek: number;
  dbPath: string;
  systemPrompt: string;
}

export const DEFAULT_CONFIG: MithrilConfig = {
  plannerModel: 'anthropic/claude-sonnet-4-20250514',
  extractorModel: 'anthropic/claude-haiku-4-5-20251001',
  embeddingModel: 'openai/text-embedding-3-small',
  similarityThreshold: 0.85,
  confidenceThreshold: 0.90,
  ambiguousZoneLower: 0.70,
  minTracesForTemplate: 3,
  failuresToDegrade: 3,
  degradeSuccessRate: 0.70,
  ttlDays: 30,
  decayPerWeek: 0.01,
  dbPath: './mithril.db',
  systemPrompt: 'You are a helpful assistant. Use the available tools to resolve the user request.',
};

export interface Store {
  saveTrace(trace: Trace): void;
  getUnclassifiedTraces(): Trace[];
  getTracesByTemplateId(templateId: string, limit?: number): Trace[];
  markTracesClassified(traceIds: string[]): void;
  updateTraceEmbedding(traceId: string, embedding: number[]): void;
  saveTemplate(template: Template): void;
  getAllActiveTemplates(): Template[];
  getTemplate(templateId: string): Template | null;
  updateTemplateAfterExecution(templateId: string, success: boolean): void;
  degradeTemplate(templateId: string): void;
  logRouting(entry: {
    userMessage: string;
    phase: number;
    reason: string;
    templateId?: string;
    similarity?: number;
    confidence?: number;
    latencyMs?: number;
    costUsd?: number;
    success?: boolean;
  }): void;
  getMetrics(): any;
}
