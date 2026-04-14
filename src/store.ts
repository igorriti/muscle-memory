import Database from 'better-sqlite3';
import { Trace, Template, Store } from './types.js';

export class SqliteStore implements Store {
  private db: Database.Database;

  constructor(path: string = './muscle-memory.db') {
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  private migrate() {
    this.db.exec(`
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
        confidence REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
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
  }

  saveTrace(trace: Trace): void {
    this.db.prepare(`
      INSERT INTO traces (trace_id, timestamp, user_message, embedding, data, success, phase, template_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      trace.traceId,
      trace.timestamp,
      trace.userMessage,
      trace.userMessageEmbedding ? JSON.stringify(trace.userMessageEmbedding) : null,
      JSON.stringify(trace),
      trace.success ? 1 : 0,
      trace.phase,
      trace.templateId
    );
  }

  getUnclassifiedTraces(): Trace[] {
    const rows = this.db.prepare(
      'SELECT data FROM traces WHERE success = 1 AND classified = 0 AND embedding IS NOT NULL'
    ).all() as { data: string }[];
    return rows.map(r => JSON.parse(r.data));
  }

  getTracesByTemplateId(templateId: string, limit = 20): Trace[] {
    const rows = this.db.prepare(
      'SELECT data FROM traces WHERE template_id = ? ORDER BY timestamp DESC LIMIT ?'
    ).all(templateId, limit) as { data: string }[];
    return rows.map(r => JSON.parse(r.data));
  }

  markTracesClassified(traceIds: string[]): void {
    const stmt = this.db.prepare('UPDATE traces SET classified = 1 WHERE trace_id = ?');
    const tx = this.db.transaction(() => {
      for (const id of traceIds) stmt.run(id);
    });
    tx();
  }

  updateTraceEmbedding(traceId: string, embedding: number[]): void {
    this.db.prepare('UPDATE traces SET embedding = ? WHERE trace_id = ?')
      .run(JSON.stringify(embedding), traceId);
  }

  saveTemplate(template: Template): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO templates
      (template_id, name, embedding, data, confidence, status, created_at, last_used_at, total_executions, successful_executions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      template.templateId,
      template.name,
      JSON.stringify(template.embedding),
      JSON.stringify(template),
      template.confidence,
      template.status,
      template.createdAt,
      template.lastUsedAt,
      template.totalExecutions,
      template.successfulExecutions
    );
  }

  getAllActiveTemplates(): Template[] {
    const rows = this.db.prepare(
      "SELECT data FROM templates WHERE status = 'active'"
    ).all() as { data: string }[];
    return rows.map(r => JSON.parse(r.data));
  }

  getTemplate(templateId: string): Template | null {
    const row = this.db.prepare(
      'SELECT data FROM templates WHERE template_id = ?'
    ).get(templateId) as { data: string } | undefined;
    return row ? JSON.parse(row.data) : null;
  }

  updateTemplateAfterExecution(templateId: string, success: boolean): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE templates SET
        total_executions = total_executions + 1,
        successful_executions = successful_executions + CASE WHEN ? THEN 1 ELSE 0 END,
        last_used_at = ?,
        confidence = CAST(successful_executions + CASE WHEN ? THEN 1 ELSE 0 END AS REAL)
                     / (total_executions + 1)
      WHERE template_id = ?
    `).run(success ? 1 : 0, now, success ? 1 : 0, templateId);
  }

  degradeTemplate(templateId: string): void {
    this.db.prepare("UPDATE templates SET status = 'degraded' WHERE template_id = ?")
      .run(templateId);
  }

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
  }): void {
    this.db.prepare(`
      INSERT INTO routing_log (timestamp, user_message, phase, reason, template_id, similarity, confidence, latency_ms, cost_usd, success)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      new Date().toISOString(),
      entry.userMessage,
      entry.phase,
      entry.reason,
      entry.templateId ?? null,
      entry.similarity ?? null,
      entry.confidence ?? null,
      entry.latencyMs ?? null,
      entry.costUsd ?? null,
      entry.success != null ? (entry.success ? 1 : 0) : null
    );
  }

  getMetrics() {
    const total = this.db.prepare('SELECT COUNT(*) as c FROM traces').get() as { c: number };
    const byPhase = this.db.prepare(
      'SELECT phase, COUNT(*) as c, AVG(json_extract(data, "$.totalLatencyMs")) as avgLat, AVG(json_extract(data, "$.totalCostUsd")) as avgCost FROM traces GROUP BY phase'
    ).all() as { phase: number; c: number; avgLat: number; avgCost: number }[];
    const successRate = this.db.prepare(
      'SELECT CAST(SUM(success) AS REAL) / COUNT(*) as rate FROM traces'
    ).get() as { rate: number };
    return { total: total.c, byPhase, successRate: successRate.rate };
  }
}
