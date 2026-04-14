import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import * as fs from 'fs';
import { Trace, Template, Store } from './types.js';

let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;

async function getSql() {
  if (!SQL) SQL = await initSqlJs();
  return SQL;
}

export class SqliteStore implements Store {
  private db!: SqlJsDatabase;
  private dbPath: string;
  private ready: Promise<void>;

  constructor(path: string = './muscle-memory.db') {
    this.dbPath = path;
    this.ready = this.init();
  }

  private async init() {
    const sql = await getSql();
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new sql.Database(buffer);
    } else {
      this.db = new sql.Database();
    }
    this.migrate();
  }

  private ensureReady() {
    if (!this.db) throw new Error('SqliteStore not initialized. Await .waitReady() first.');
  }

  async waitReady(): Promise<void> {
    await this.ready;
  }

  private migrate() {
    this.db.run(`
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
      )
    `);
    this.db.run(`
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
      )
    `);
    this.db.run(`
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
      )
    `);
    this.db.run('CREATE INDEX IF NOT EXISTS idx_traces_success ON traces(success)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_traces_classified ON traces(classified)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_traces_phase ON traces(phase)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_templates_status ON templates(status)');
  }

  private persist() {
    const data = this.db.export();
    fs.writeFileSync(this.dbPath, Buffer.from(data));
  }

  private queryAll(sql: string, params: any[] = []): any[] {
    this.ensureReady();
    const stmt = this.db.prepare(sql);
    if (params.length) stmt.bind(params);
    const rows: any[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  private queryOne(sql: string, params: any[] = []): any | null {
    const rows = this.queryAll(sql, params);
    return rows[0] ?? null;
  }

  private execute(sql: string, params: any[] = []) {
    this.ensureReady();
    this.db.run(sql, params);
    this.persist();
  }

  saveTrace(trace: Trace): void {
    this.execute(
      `INSERT INTO traces (trace_id, timestamp, user_message, embedding, data, success, phase, template_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trace.traceId,
        trace.timestamp,
        trace.userMessage,
        trace.userMessageEmbedding ? JSON.stringify(trace.userMessageEmbedding) : null,
        JSON.stringify(trace),
        trace.success ? 1 : 0,
        trace.phase,
        trace.templateId,
      ]
    );
  }

  getUnclassifiedTraces(): Trace[] {
    const rows = this.queryAll(
      'SELECT data FROM traces WHERE success = 1 AND classified = 0 AND embedding IS NOT NULL'
    );
    return rows.map((r: any) => JSON.parse(r.data));
  }

  getTracesByTemplateId(templateId: string, limit = 20): Trace[] {
    const rows = this.queryAll(
      'SELECT data FROM traces WHERE template_id = ? ORDER BY timestamp DESC LIMIT ?',
      [templateId, limit]
    );
    return rows.map((r: any) => JSON.parse(r.data));
  }

  markTracesClassified(traceIds: string[]): void {
    for (const id of traceIds) {
      this.db.run('UPDATE traces SET classified = 1 WHERE trace_id = ?', [id]);
    }
    this.persist();
  }

  updateTraceEmbedding(traceId: string, embedding: number[]): void {
    this.execute(
      'UPDATE traces SET embedding = ? WHERE trace_id = ?',
      [JSON.stringify(embedding), traceId]
    );
  }

  saveTemplate(template: Template): void {
    this.execute(
      `INSERT OR REPLACE INTO templates
       (template_id, name, embedding, data, confidence, status, created_at, last_used_at, total_executions, successful_executions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        template.templateId,
        template.name,
        JSON.stringify(template.embedding),
        JSON.stringify(template),
        template.confidence,
        template.status,
        template.createdAt,
        template.lastUsedAt,
        template.totalExecutions,
        template.successfulExecutions,
      ]
    );
  }

  getAllActiveTemplates(): Template[] {
    const rows = this.queryAll("SELECT data FROM templates WHERE status = 'active'");
    return rows.map((r: any) => JSON.parse(r.data));
  }

  getTemplate(templateId: string): Template | null {
    const row = this.queryOne('SELECT data FROM templates WHERE template_id = ?', [templateId]);
    return row ? JSON.parse(row.data) : null;
  }

  updateTemplateAfterExecution(templateId: string, success: boolean): void {
    const now = new Date().toISOString();
    this.execute(
      `UPDATE templates SET
        total_executions = total_executions + 1,
        successful_executions = successful_executions + CASE WHEN ? THEN 1 ELSE 0 END,
        last_used_at = ?,
        confidence = CAST(successful_executions + CASE WHEN ? THEN 1 ELSE 0 END AS REAL)
                     / (total_executions + 1)
      WHERE template_id = ?`,
      [success ? 1 : 0, now, success ? 1 : 0, templateId]
    );
  }

  degradeTemplate(templateId: string): void {
    this.execute("UPDATE templates SET status = 'degraded' WHERE template_id = ?", [templateId]);
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
    this.execute(
      `INSERT INTO routing_log (timestamp, user_message, phase, reason, template_id, similarity, confidence, latency_ms, cost_usd, success)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        new Date().toISOString(),
        entry.userMessage,
        entry.phase,
        entry.reason,
        entry.templateId ?? null,
        entry.similarity ?? null,
        entry.confidence ?? null,
        entry.latencyMs ?? null,
        entry.costUsd ?? null,
        entry.success != null ? (entry.success ? 1 : 0) : null,
      ]
    );
  }

  getMetrics() {
    const total = this.queryOne('SELECT COUNT(*) as c FROM traces');
    const byPhase = this.queryAll(
      'SELECT phase, COUNT(*) as c FROM traces GROUP BY phase'
    );
    const successRate = this.queryOne(
      'SELECT CAST(SUM(success) AS REAL) / COUNT(*) as rate FROM traces'
    );
    return {
      total: total?.c ?? 0,
      byPhase: byPhase.map((r: any) => ({ phase: r.phase, c: r.c, avgLat: 0, avgCost: 0 })),
      successRate: successRate?.rate ?? 0,
    };
  }
}
