/**
 * Seed the web demo DB with pre-built templates and traces.
 * Run: npx tsx seed.ts
 *
 * After seeding, Phase 3 works immediately for:
 *   cancel_order, track_order, process_refund, check_order_status, get_shipping_status
 */
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

const DB_PATH = './muscle-memory.db';

// Template definitions: name → tool chain + arg schema
const TEMPLATES: {
  name: string;
  tools: { tool: string; argsTemplate: Record<string, string> }[];
  argSchema: { name: string; type: 'string'; required: boolean; description: string; examples: string[] }[];
}[] = [
  {
    name: 'cancel_order',
    tools: [
      { tool: 'get_order', argsTemplate: { order_id: '{order_id}' } },
      { tool: 'cancel_order', argsTemplate: { order_id: '{order_id}' } },
      { tool: 'process_refund', argsTemplate: { order_id: '{order_id}' } },
    ],
    argSchema: [{ name: 'order_id', type: 'string', required: true, description: 'The order ID to cancel', examples: ['ORD-412', 'ORD-789'] }],
  },
  {
    name: 'track_order',
    tools: [
      { tool: 'get_order', argsTemplate: { order_id: '{order_id}' } },
      { tool: 'get_shipping_status', argsTemplate: { order_id: '{order_id}' } },
    ],
    argSchema: [{ name: 'order_id', type: 'string', required: true, description: 'The order ID to track', examples: ['ORD-100', 'ORD-332'] }],
  },
  {
    name: 'process_refund',
    tools: [
      { tool: 'get_order', argsTemplate: { order_id: '{order_id}' } },
      { tool: 'process_refund', argsTemplate: { order_id: '{order_id}' } },
    ],
    argSchema: [{ name: 'order_id', type: 'string', required: true, description: 'The order ID to refund', examples: ['ORD-207', 'ORD-555'] }],
  },
  {
    name: 'check_order_status',
    tools: [
      { tool: 'get_order', argsTemplate: { order_id: '{order_id}' } },
    ],
    argSchema: [{ name: 'order_id', type: 'string', required: true, description: 'The order ID to check', examples: ['ORD-300', 'ORD-450'] }],
  },
  {
    name: 'get_shipping_status',
    tools: [
      { tool: 'get_shipping_status', argsTemplate: { order_id: '{order_id}' } },
    ],
    argSchema: [{ name: 'order_id', type: 'string', required: true, description: 'The order ID', examples: ['ORD-100', 'ORD-200'] }],
  },
];

// Sample queries per pattern (for generating fake traces)
const QUERIES: Record<string, string[]> = {
  cancel_order: [
    'Cancel my order ORD-412',
    'hey i need to cancel order 789 asap',
    'please cancel ORD-555 i ordered the wrong thing',
    'i want to cancel. order number is 333',
    'cancel ORD-101, bought it by accident',
  ],
  track_order: [
    'Where is my order ORD-100?',
    'track order 332 please',
    'can you check shipping status for order ORD-450',
    'whats happening with my delivery ORD-600',
    'my package ORD-221 hasnt arrived, can you track it',
  ],
  process_refund: [
    'I need a refund for order ORD-207',
    'refund me for ORD-444 please, product was broken',
    'process a refund for ORD-888',
    'i want my money back for order ORD-123',
    'ORD-555 refund request',
  ],
  check_order_status: [
    'What is the status of order ORD-300?',
    'is my order ORD-450 confirmed?',
    'status update for ORD-700 please',
    'has my order ORD-900 been processed yet?',
    'order ORD-150 status?',
  ],
  get_shipping_status: [
    'Shipping status for ORD-100',
    'Where is my shipment for order ORD-200?',
    'delivery status ORD-350',
    'has ORD-500 shipped yet?',
    'shipping info for order ORD-750',
  ],
};

// Mock tool outputs
const TOOL_OUTPUTS: Record<string, (orderId: string) => any> = {
  get_order: (order_id) => ({ order_id, status: 'processing', customer_email: 'customer@example.com', total: 59.99, items: ['Widget A', 'Widget B'] }),
  cancel_order: (order_id) => ({ order_id, cancelled: true }),
  process_refund: (order_id) => ({ order_id, refund_amount: 59.99, status: 'initiated' }),
  get_shipping_status: (order_id) => ({ order_id, status: 'in_transit', carrier: 'FedEx', tracking: '1Z999AA10123456784', estimated_delivery: '2026-04-18' }),
};

function buildGraph(tools: { tool: string; argsTemplate: Record<string, string> }[]) {
  const nodes = tools.map((t, i) => ({
    id: `n${i}`,
    tool: t.tool,
    argsTemplate: t.argsTemplate,
  }));
  const edges = tools.slice(0, -1).map((_, i) => ({
    from: `n${i}`,
    to: `n${i + 1}`,
    condition: null,
    weight: 1.0,
    type: 'normal' as const,
  }));
  return { nodes, edges, rootNodeId: 'n0' };
}

function buildTrace(
  templateName: string,
  query: string,
  tools: { tool: string; argsTemplate: Record<string, string> }[],
  phase: 1 | 3,
  templateId: string | null,
): any {
  const orderId = query.match(/ORD-?(\d+)|\b(\d{3,})\b/i);
  const oid = orderId ? `ORD-${orderId[1] ?? orderId[2]}` : 'ORD-100';
  const steps = tools.map((t, i) => ({
    stepId: i,
    toolName: t.tool,
    toolInput: { order_id: oid },
    toolOutput: (TOOL_OUTPUTS[t.tool] ?? (() => ({ success: true })))(oid),
    latencyMs: phase === 1 ? 200 + Math.random() * 300 : 10 + Math.random() * 20,
    success: true,
    dependsOn: i > 0 ? i - 1 : null,
  }));

  return {
    traceId: randomUUID(),
    timestamp: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(),
    userMessage: query,
    userMessageEmbedding: null,
    steps,
    finalResponse: JSON.stringify(steps.map(s => ({ tool: s.toolName, result: s.toolOutput }))),
    totalTokens: phase === 1 ? 800 + Math.floor(Math.random() * 400) : 0,
    totalCostUsd: phase === 1 ? 0.015 + Math.random() * 0.01 : 0.001,
    totalLatencyMs: phase === 1 ? 3000 + Math.random() * 2000 : 100 + Math.random() * 150,
    success: true,
    phase,
    templateId,
    routingReason: phase === 1 ? 'No template match' : 'Muscle memory -- template match with high confidence',
  };
}

// ─── Main ───

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');

// Create tables (same schema as SqliteStore)
db.exec(`
  CREATE TABLE IF NOT EXISTS traces (
    trace_id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    user_message TEXT NOT NULL,
    embedding TEXT,
    data TEXT NOT NULL,
    success INTEGER NOT NULL,
    phase INTEGER NOT NULL,
    template_id TEXT,
    classified INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS templates (
    template_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    embedding TEXT NOT NULL,
    data TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL,
    last_used_at TEXT NOT NULL,
    total_executions INTEGER DEFAULT 0,
    successful_executions INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS routing_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    user_message TEXT NOT NULL,
    phase INTEGER NOT NULL,
    reason TEXT NOT NULL,
    template_id TEXT,
    similarity REAL,
    confidence REAL,
    latency_ms REAL,
    cost_usd REAL,
    success INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_traces_success ON traces(success);
  CREATE INDEX IF NOT EXISTS idx_traces_classified ON traces(classified);
  CREATE INDEX IF NOT EXISTS idx_traces_phase ON traces(phase);
  CREATE INDEX IF NOT EXISTS idx_templates_status ON templates(status);
`);

// Clear existing data
db.exec('DELETE FROM traces; DELETE FROM templates; DELETE FROM routing_log;');

const insertTrace = db.prepare(`
  INSERT INTO traces (trace_id, timestamp, user_message, embedding, data, success, phase, template_id, classified)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertTemplate = db.prepare(`
  INSERT INTO templates (template_id, name, embedding, data, confidence, status, created_at, last_used_at, total_executions, successful_executions)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertRouting = db.prepare(`
  INSERT INTO routing_log (timestamp, user_message, phase, reason, template_id, similarity, confidence, latency_ms, cost_usd, success)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let totalTraces = 0;
let totalTemplates = 0;

db.exec('BEGIN');

for (const tpl of TEMPLATES) {
  const templateId = randomUUID();
  const graph = buildGraph(tpl.tools);
  const now = new Date().toISOString();
  const queries = QUERIES[tpl.name] ?? [];

  // Insert Phase 1 traces (the "learning" phase)
  for (const query of queries) {
    const trace = buildTrace(tpl.name, query, tpl.tools, 1, null);
    insertTrace.run(
      trace.traceId, trace.timestamp, trace.userMessage, null,
      JSON.stringify(trace), 1, 1, null, 1,
    );
    insertRouting.run(
      trace.timestamp, trace.userMessage, 1, 'No template match',
      null, null, null, trace.totalLatencyMs, trace.totalCostUsd, 1,
    );
    totalTraces++;
  }

  // Insert a few Phase 3 traces (to show it's been working)
  const p3Queries = [
    `Cancel order ORD-${900 + totalTemplates}`,
    `Track my order ORD-${910 + totalTemplates}`,
    `Refund order ORD-${920 + totalTemplates}`,
  ].slice(0, 2);

  for (const query of p3Queries) {
    const trace = buildTrace(tpl.name, query, tpl.tools, 3, templateId);
    insertTrace.run(
      trace.traceId, trace.timestamp, trace.userMessage, null,
      JSON.stringify(trace), 1, 3, templateId, 1,
    );
    insertRouting.run(
      trace.timestamp, trace.userMessage, 3,
      `Template match (sim=1.000, conf=0.950)`,
      templateId, 1.0, 0.95, trace.totalLatencyMs, trace.totalCostUsd, 1,
    );
    totalTraces++;
  }

  // Insert the template
  const template = {
    templateId,
    name: tpl.name,
    embedding: [],
    argSchema: tpl.argSchema,
    graph,
    confidence: 0.95,
    totalExecutions: queries.length + p3Queries.length,
    successfulExecutions: queries.length + p3Queries.length,
    createdAt: now,
    lastUsedAt: now,
    ttlDays: 30,
    status: 'active' as const,
  };

  insertTemplate.run(
    templateId, tpl.name, JSON.stringify([]), JSON.stringify(template),
    0.95, 'active', now, now,
    template.totalExecutions, template.successfulExecutions,
  );
  totalTemplates++;
}

db.exec('COMMIT');

console.log(`Seeded ${totalTemplates} templates and ${totalTraces} traces into ${DB_PATH}`);
console.log('Templates:', TEMPLATES.map(t => t.name).join(', '));
console.log('\nPhase 3 is ready. Start the web app with: npm run dev');
