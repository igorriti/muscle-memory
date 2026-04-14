#!/usr/bin/env npx tsx
/**
 * Muscle-Memory Benchmark
 *
 * Runs 1000 queries. Each query runs through BOTH paths in parallel:
 *   A) WITHOUT muscle memory — plain generateText
 *   B) WITH muscle memory — muscleMemory agent
 *
 * Real-time comparison of latency, tokens, and cost.
 */
import 'dotenv/config';
(globalThis as any).AI_SDK_LOG_WARNINGS = false;
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { muscleMemory, SqliteStore } from '../../src/index.js';
import { ecommerceTools } from './tools.js';
import { PATTERN_NAMES, makeQuery } from './queries.js';
import * as fs from 'fs';

// ════════════════════════════════════════════
//  CONFIG
// ════════════════════════════════════════════

const DB_PATH = './benchmark.db';
const TOTAL_QUERIES = 1000;
const MAX_CONCURRENT = 3;

const model = openai.chat('gpt-5.4');
const extractModel = openai.chat('gpt-5.4-nano');
const embedModel = openai.embedding('text-embedding-3-small');

// gpt-5.4 pricing per 1M tokens
const COST_IN = 1.0;
const COST_OUT = 4.0;

// ════════════════════════════════════════════
//  CONCURRENCY + RETRY
// ════════════════════════════════════════════

function semaphore(max: number) {
  let n = 0;
  const q: (() => void)[] = [];
  return {
    async acquire() { if (n >= max) await new Promise<void>(r => q.push(r)); n++; },
    release() { n--; q.shift()?.(); },
  };
}

async function retry<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e: any) {
      if ((e?.statusCode === 429 || e?.lastError?.statusCode === 429) && i < attempts - 1) {
        const wait = Math.min(2000 * (i + 1), 15000);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw e;
    }
  }
  throw new Error('unreachable');
}

// ════════════════════════════════════════════
//  DATA
// ════════════════════════════════════════════

interface Row {
  i: number;
  pattern: string;
  query: string;
  // without MM
  wo_latMs: number;
  wo_inTok: number;
  wo_outTok: number;
  wo_cost: number;
  wo_resp: string;
  wo_tools: string[];
  // with MM
  w_latMs: number;
  w_cost: number;
  w_resp: string;
  w_mem: boolean; // true = skipped LLM
  w_tools: string[];
}

// ════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════

async function main() {
  const toolCount = Object.keys(ecommerceTools).length;
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       MUSCLE MEMORY BENCHMARK                   ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`Tools: ${toolCount} | Patterns: ${PATTERN_NAMES.length} | Queries: ${TOTAL_QUERIES} | Concurrency: ${MAX_CONCURRENT}`);
  console.log(`Model: gpt-5.4 | Embedding: text-embedding-3-small\n`);

  if (!process.env.OPENAI_API_KEY) { console.error('Missing OPENAI_API_KEY'); process.exit(1); }

  // Clean DB
  for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  // Setup MM agent
  const agent = muscleMemory({
    model,
    extractionModel: extractModel,
    embeddingModel: embedModel,
    tools: ecommerceTools,
    store: new SqliteStore(DB_PATH),
    system: 'You are an e-commerce support agent. Use tools to help. Be concise.',
    minTraces: 3,
    confidence: 0.70,
    similarity: 0.65,
  });

  // Build query list: interleave patterns
  const queries: { i: number; pattern: string; query: string }[] = [];
  let qi = 0;
  for (let round = 0; qi < TOTAL_QUERIES; round++) {
    for (const p of PATTERN_NAMES) {
      if (qi >= TOTAL_QUERIES) break;
      queries.push({ i: qi, pattern: p, query: makeQuery(p, round) });
      qi++;
    }
  }

  // Results
  const rows: Row[] = [];
  let done = 0;
  let memCount = 0;
  const learnCheckpoints = new Set([100, 200, 300, 500]);
  const learnedAt = new Set<number>();
  const sem = semaphore(MAX_CONCURRENT);
  const globalStart = Date.now();

  // Accumulators for real-time display
  let woTotalCost = 0, wTotalCost = 0;
  let woTotalLat = 0, wTotalLat = 0;

  console.log('━━━ Running both paths in parallel ━━━\n');

  // Group by pattern for parallel execution
  const byPattern = new Map<string, typeof queries>();
  for (const q of queries) {
    if (!byPattern.has(q.pattern)) byPattern.set(q.pattern, []);
    byPattern.get(q.pattern)!.push(q);
  }

  const tasks = [...byPattern.entries()].map(async ([pattern, pQueries]) => {
    for (const q of pQueries) {
      await sem.acquire();
      try {
        // Run BOTH paths in parallel for this query
        const [woResult, wResult] = await Promise.all([
          // Path A: without MM
          retry(() => generateText({
            model,
            system: 'You are an e-commerce support agent. Use tools to help. Be concise.',
            tools: ecommerceTools,
            prompt: q.query,
            maxSteps: 10,
          }).then(r => {
            const u = r.usage as any ?? {};
            let text = r.text ?? '';
            if (!text) {
              text = r.steps?.flatMap((s: any) => s.toolResults ?? []).map((tr: any) => JSON.stringify(tr.result ?? tr.output)).join('; ') ?? '';
            }
            // Extract tool names called
            const toolNames = r.steps?.flatMap((s: any) => s.toolCalls ?? []).map((tc: any) => tc.toolName) ?? [];
            return {
              latMs: Date.now(),
              inTok: u.inputTokens ?? 0,
              outTok: u.outputTokens ?? 0,
              text,
              toolNames,
              start: 0,
            };
          })),

          // Path B: with MM
          retry(() => agent.run({ prompt: q.query }).then(r => {
            let text = r.text ?? '';
            if (!text) {
              text = '(empty response)';
            }
            return {
              latMs: r.latencyMs,
              cost: r.costUsd,
              text,
              mem: r.phase === 3,
            };
          })),
        ].map((p, idx) => {
          const start = Date.now();
          return (p as Promise<any>).then((r: any) => {
            r._elapsed = Date.now() - start;
            return r;
          });
        }));

        const woLat = woResult._elapsed;
        const woCost = (woResult.inTok * COST_IN + woResult.outTok * COST_OUT) / 1_000_000;

        // Extract tool names from "with" path response (JSON after fix #4)
        let wTools: string[] = [];
        try {
          const parsed = JSON.parse(wResult.text);
          if (Array.isArray(parsed)) {
            wTools = parsed.map((entry: any) => entry.tool).filter(Boolean);
          }
        } catch {
          // not JSON, can't extract tools
        }

        const row: Row = {
          i: q.i,
          pattern: q.pattern,
          query: q.query,
          wo_latMs: woLat,
          wo_inTok: woResult.inTok,
          wo_outTok: woResult.outTok,
          wo_cost: woCost,
          wo_resp: woResult.text,
          wo_tools: woResult.toolNames ?? [],
          w_latMs: wResult._elapsed,
          w_cost: wResult.cost,
          w_resp: wResult.text,
          w_mem: wResult.mem,
          w_tools: wTools,
        };
        rows.push(row);

        woTotalCost += woCost;
        wTotalCost += wResult.cost;
        woTotalLat += woLat;
        wTotalLat += wResult._elapsed;
        if (wResult.mem) memCount++;
        done++;

        // Trigger learning at multiple checkpoints
        for (const checkpoint of learnCheckpoints) {
          if (done >= checkpoint && !learnedAt.has(checkpoint)) {
            learnedAt.add(checkpoint);
            // Wait for embeddings to complete
            await new Promise(r => setTimeout(r, checkpoint === 100 ? 5000 : 3000));
            const lr = await agent.learn();
            // Show what templates exist
            const metrics = agent.metrics();
            const matchRate = done > 0 ? ((memCount / done) * 100).toFixed(0) : '0';
            console.log(`  >>> LEARNED @${checkpoint}: +${lr.templatesCreated} templates | match rate: ${matchRate}% <<<`);
            break; // only one learn per query completion
          }
        }

        // Progress every 50
        if (done % 50 === 0) {
          const el = ((Date.now() - globalStart) / 1000).toFixed(0);
          const avgWoLat = woTotalLat / done;
          const avgWLat = wTotalLat / done;
          const speedup = avgWLat > 0 ? (avgWoLat / avgWLat).toFixed(1) : '-';
          console.log(
            `  [${done}/${TOTAL_QUERIES}] ${el}s` +
            ` | Without: $${woTotalCost.toFixed(4)} avg ${avgWoLat.toFixed(0)}ms` +
            ` | With MM: $${wTotalCost.toFixed(4)} avg ${avgWLat.toFixed(0)}ms` +
            ` | Memory: ${memCount}` +
            ` | Speedup: ${speedup}x`
          );
        }
      } finally {
        sem.release();
      }
    }
  });

  await Promise.all(tasks);

  const totalTime = ((Date.now() - globalStart) / 1000).toFixed(1);
  console.log(`\n  DONE: ${done} queries in ${totalTime}s\n`);

  // ─── SORT & AGGREGATE ───

  rows.sort((a, b) => a.i - b.i);

  const totalWoLat = rows.reduce((s, r) => s + r.wo_latMs, 0);
  const totalWLat = rows.reduce((s, r) => s + r.w_latMs, 0);
  const totalWoCost = rows.reduce((s, r) => s + r.wo_cost, 0);
  const totalWCost = rows.reduce((s, r) => s + r.w_cost, 0);
  const totalWoTok = rows.reduce((s, r) => s + r.wo_inTok + r.wo_outTok, 0);
  const memUsed = rows.filter(r => r.w_mem).length;

  // ─── SUMMARY ───

  const avgWoLat = totalWoLat / rows.length;
  const avgWLat = totalWLat / rows.length;
  const avgSpeedup = avgWLat > 0 ? (avgWoLat / avgWLat).toFixed(1) : '-';

  console.log('━━━ SUMMARY ━━━');
  console.log(`  WITHOUT MM: avg ${avgWoLat.toFixed(0)}ms/query | $${totalWoCost.toFixed(4)} | ${totalWoTok.toLocaleString()} tokens`);
  console.log(`  WITH    MM: avg ${avgWLat.toFixed(0)}ms/query | $${totalWCost.toFixed(4)} | ${memUsed} queries skipped LLM`);
  console.log(`  Speedup: ${avgSpeedup}x (avg latency) | Cost savings: ${((1 - totalWCost / totalWoCost) * 100).toFixed(1)}%`);

  // ─── MILESTONES ───

  console.log('\n━━━ MILESTONES ━━━');
  console.log('| Queries | Wo avg lat | Without ($)  | Without (tok) | W avg lat  | With MM ($)  | Memory | Speedup | Savings |');
  console.log('|---------|------------|-------------|--------------|------------|-------------|--------|---------|---------|');
  for (const m of [10, 50, 100, 250, 500, 1000]) {
    const s = rows.slice(0, Math.min(m, rows.length));
    if (s.length === 0) continue;
    const wol = s.reduce((a, r) => a + r.wo_latMs, 0);
    const woc = s.reduce((a, r) => a + r.wo_cost, 0);
    const wot = s.reduce((a, r) => a + r.wo_inTok + r.wo_outTok, 0);
    const wl = s.reduce((a, r) => a + r.w_latMs, 0);
    const wc = s.reduce((a, r) => a + r.w_cost, 0);
    const wm = s.filter(r => r.w_mem).length;
    const avgWo = wol / s.length;
    const avgW = wl / s.length;
    const sp = avgW > 0 ? (avgWo / avgW).toFixed(1) : '-';
    const sv = woc > 0 ? ((1 - wc / woc) * 100).toFixed(0) : '-';
    console.log(
      `| ${String(m).padStart(7)} | ${(avgWo.toFixed(0) + 'ms').padEnd(10)} | $${woc.toFixed(4).padEnd(10)} | ${wot.toLocaleString().padEnd(12)} | ${(avgW.toFixed(0) + 'ms').padEnd(10)} | $${wc.toFixed(4).padEnd(10)} | ${String(wm).padEnd(6)} | ${(sp + 'x').padEnd(7)} | ${(sv + '%').padEnd(7)} |`
    );
  }

  // ─── SAMPLE RESPONSE COMPARISON ───

  console.log('\n━━━ RESPONSE COMPARISON (memory-served queries) ━━━');
  const memRows = rows.filter(r => r.w_mem).slice(0, 5);
  for (const r of memRows) {
    console.log(`  Query: "${r.query.slice(0, 60)}"`);
    console.log(`    Without: "${r.wo_resp.slice(0, 100)}"`);
    console.log(`    With MM: "${r.w_resp.slice(0, 100)}"`);
    console.log();
  }

  // ─── CORRECTNESS ───

  let matchingTools = 0;
  let woCorrect = 0;
  let wCorrect = 0;
  let bothCorrect = 0;

  for (const r of rows) {
    // A "correct" response: non-empty (length > 10) and contains data
    const woOk = r.wo_resp.length > 10;
    const wOk = r.w_resp.length > 10;
    if (woOk) woCorrect++;
    if (wOk) wCorrect++;
    if (woOk && wOk) bothCorrect++;

    // Compare tool names called
    const woToolsSorted = [...r.wo_tools].sort().join(',');
    const wToolsSorted = [...r.w_tools].sort().join(',');
    if (woToolsSorted === wToolsSorted && woToolsSorted.length > 0) {
      matchingTools++;
    }
  }

  console.log('\n━━━ CORRECTNESS ━━━');
  console.log(`  Without MM correct (resp > 10 chars): ${woCorrect}/${rows.length} (${(woCorrect / rows.length * 100).toFixed(1)}%)`);
  console.log(`  With    MM correct (resp > 10 chars): ${wCorrect}/${rows.length} (${(wCorrect / rows.length * 100).toFixed(1)}%)`);
  console.log(`  Both correct:                         ${bothCorrect}/${rows.length} (${(bothCorrect / rows.length * 100).toFixed(1)}%)`);
  console.log(`  Matching tool calls:                  ${matchingTools}/${rows.length} (${(matchingTools / rows.length * 100).toFixed(1)}%)`);

  // ─── SAVE JSON ───

  const output = {
    config: { tools: toolCount, patterns: PATTERN_NAMES.length, total: TOTAL_QUERIES, model: 'gpt-5.4' },
    rows: rows.map(r => ({
      i: r.i, p: r.pattern,
      wo: { lat: r.wo_latMs, tok: r.wo_inTok + r.wo_outTok, cost: r.wo_cost },
      w: { lat: r.w_latMs, cost: r.w_cost, mem: r.w_mem },
    })),
    summary: {
      without: { avgLatMs: +avgWoLat.toFixed(0), totalCost: totalWoCost, totalTokens: totalWoTok },
      with: { avgLatMs: +avgWLat.toFixed(0), totalCost: totalWCost, memoryUsed: memUsed },
      speedup: avgSpeedup,
      costSavings: ((1 - totalWCost / totalWoCost) * 100).toFixed(1),
    },
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync('./benchmark-results.json', JSON.stringify(output, null, 2));
  console.log('Results saved to benchmark-results.json');

  // Cleanup DB
  for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

function fmt(ms: number) { return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(1)}s`; }

main().catch(err => {
  console.error('\nBenchmark failed:', err.message ?? err);
  process.exit(1);
});
