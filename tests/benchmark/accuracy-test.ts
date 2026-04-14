#!/usr/bin/env npx tsx
/**
 * Accuracy Test — 500 queries, both paths, compare tools called.
 *
 * No seeding. The MM agent learns on the fly as queries come in.
 * For each query we capture the exact tools called by:
 *   A) Without MM (plain generateText)
 *   B) With MM (muscleMemory — learns over time, eventually skips LLM)
 *
 * Then compare: exact match, core tool match, any overlap.
 */
import 'dotenv/config';
(globalThis as any).AI_SDK_LOG_WARNINGS = false;
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { muscleMemory, SqliteStore } from '../../src/index.js';
import { ecommerceTools } from './tools.js';
import { PATTERN_NAMES, makeQuery } from './queries.js';
import * as fs from 'fs';

const DB = './accuracy-test.db';
const TOTAL = 500;

const model = openai.chat('gpt-5.4');

function semaphore(max: number) {
  let n = 0; const q: (() => void)[] = [];
  return {
    async acquire() { if (n >= max) await new Promise<void>(r => q.push(r)); n++; },
    release() { n--; q.shift()?.(); },
  };
}

async function retry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e: any) {
      if ((e?.statusCode === 429 || e?.lastError?.statusCode === 429) && i < attempts - 1) {
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
  throw new Error('unreachable');
}

interface Row {
  i: number;
  pattern: string;
  query: string;
  wo_tools: string[];
  w_tools: string[];
  w_phase: 1 | 3;
  exactMatch: boolean;
  coreMatch: boolean;
  anyOverlap: boolean;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       ACCURACY TEST — 500 queries               ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  for (const f of [DB, `${DB}-wal`, `${DB}-shm`]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  const agent = muscleMemory({
    model,
    extractionModel: openai.chat('gpt-5.4-nano'),
    embeddingModel: openai.embedding('text-embedding-3-small'),
    tools: ecommerceTools,
    store: new SqliteStore(DB),
    system: 'You are an e-commerce support agent. Use tools to help. Be concise.',
    minTraces: 3,
    confidence: 0.70,
    similarity: 0.65,
  });

  // Build queries — interleave patterns
  const queries: { pattern: string; query: string }[] = [];
  let qi = 0;
  for (let round = 0; qi < TOTAL; round++) {
    for (const p of PATTERN_NAMES) {
      if (qi >= TOTAL) break;
      queries.push({ pattern: p, query: makeQuery(p, round) });
      qi++;
    }
  }

  // Learning checkpoints
  const learnAt = new Set([100, 200, 300]);
  const learned = new Set<number>();

  const results: Row[] = [];
  const sem = semaphore(3);
  let done = 0;

  const tasks = queries.map(async (q, idx) => {
    await sem.acquire();
    try {
      const [woRes, wRes] = await Promise.all([
        // Without MM
        retry(async () => {
          const r = await generateText({
            model,
            system: 'You are an e-commerce support agent. Use tools to help. Be concise.',
            tools: ecommerceTools,
            prompt: q.query,
            maxSteps: 10,
          });
          return r.steps?.flatMap(s => s.toolCalls ?? []).map(tc => tc.toolName) ?? [];
        }),
        // With MM
        retry(async () => {
          const r = await agent.run({ prompt: q.query });
          let tools: string[] = [];
          if (r.phase === 3) {
            try {
              const parsed = JSON.parse(r.text);
              if (Array.isArray(parsed)) tools = parsed.map((e: any) => e.tool).filter(Boolean);
            } catch {}
          }
          return { tools, phase: r.phase as 1 | 3 };
        }),
      ]);

      // For Phase 1, the MM agent called the LLM too, so tools are ~same as without
      const wTools = wRes.phase === 1 ? woRes : wRes.tools;

      const exactMatch = woRes.join(',') === wTools.join(',');
      const coreMatch = woRes.length > 0 && wTools.length > 0 && woRes[0] === wTools[0];
      const woSet = new Set(woRes);
      const anyOverlap = wTools.length > 0 && wTools.some(t => woSet.has(t));

      results.push({
        i: idx, pattern: q.pattern, query: q.query,
        wo_tools: woRes, w_tools: wTools as string[],
        w_phase: wRes.phase,
        exactMatch, coreMatch, anyOverlap,
      });

      done++;

      // Learn at checkpoints
      for (const cp of learnAt) {
        if (done >= cp && !learned.has(cp)) {
          learned.add(cp);
          await new Promise(r => setTimeout(r, cp === 100 ? 5000 : 3000));
          const lr = await agent.learn();
          console.log(`  >>> LEARNED @${cp}: +${lr.templatesCreated} templates <<<`);
          break;
        }
      }

      // Progress
      if (done % 50 === 0) {
        const mem = results.filter(r => r.w_phase === 3).length;
        const exact = results.filter(r => r.exactMatch).length;
        const core = results.filter(r => r.coreMatch).length;
        console.log(`  [${done}/${TOTAL}] memory: ${mem} | exact: ${exact}/${done} (${(exact/done*100).toFixed(0)}%) | core: ${core}/${done} (${(core/done*100).toFixed(0)}%)`);
      }
    } finally {
      sem.release();
    }
  });

  await Promise.all(tasks);
  results.sort((a, b) => a.i - b.i);

  // ── Results ──
  const mem = results.filter(r => r.w_phase === 3);
  const llm = results.filter(r => r.w_phase === 1);
  const memExact = mem.filter(r => r.exactMatch).length;
  const memCore = mem.filter(r => r.coreMatch).length;
  const memOverlap = mem.filter(r => r.anyOverlap).length;

  console.log('\n━━━ RESULTS ━━━\n');
  console.log(`Total:          ${results.length}`);
  console.log(`Memory-served:  ${mem.length} (${(mem.length/results.length*100).toFixed(0)}%)`);
  console.log(`LLM-served:     ${llm.length}`);

  console.log(`\n  ALL QUERIES:`);
  console.log(`    Exact match:  ${results.filter(r => r.exactMatch).length}/${results.length} (${(results.filter(r=>r.exactMatch).length/results.length*100).toFixed(1)}%)`);
  console.log(`    Core match:   ${results.filter(r => r.coreMatch).length}/${results.length} (${(results.filter(r=>r.coreMatch).length/results.length*100).toFixed(1)}%)`);
  console.log(`    Any overlap:  ${results.filter(r => r.anyOverlap).length}/${results.length} (${(results.filter(r=>r.anyOverlap).length/results.length*100).toFixed(1)}%)`);

  console.log(`\n  MEMORY-SERVED ONLY (the ones that skipped the LLM):`);
  console.log(`    Exact match:  ${memExact}/${mem.length} (${mem.length > 0 ? (memExact/mem.length*100).toFixed(1) : 0}%)`);
  console.log(`    Core match:   ${memCore}/${mem.length} (${mem.length > 0 ? (memCore/mem.length*100).toFixed(1) : 0}%)`);
  console.log(`    Any overlap:  ${memOverlap}/${mem.length} (${mem.length > 0 ? (memOverlap/mem.length*100).toFixed(1) : 0}%)`);

  // Per-pattern
  console.log('\n━━━ PER-PATTERN ━━━\n');
  console.log('Pattern'.padEnd(25) + 'Total  Mem   Exact  Core   Sample: without → with');
  console.log('-'.repeat(100));

  for (const p of PATTERN_NAMES) {
    const pr = results.filter(r => r.pattern === p);
    const pm = pr.filter(r => r.w_phase === 3);
    const pe = pr.filter(r => r.exactMatch);
    const pc = pr.filter(r => r.coreMatch);
    const sample = pm[0] || pr[0];
    console.log(
      p.padEnd(25) +
      String(pr.length).padEnd(7) +
      String(pm.length).padEnd(6) +
      String(pe.length).padEnd(7) +
      String(pc.length).padEnd(7) +
      `[${sample?.wo_tools.join('→')||'-'}] → [${sample?.w_tools.join('→')||'-'}]`
    );
  }

  // Mismatches
  const misses = mem.filter(r => !r.coreMatch).slice(0, 10);
  if (misses.length > 0) {
    console.log('\n━━━ MISMATCHES (memory queries with wrong core tool) ━━━\n');
    for (const r of misses) {
      console.log(`  [${r.pattern}] "${r.query.slice(0, 55)}"`);
      console.log(`    Without: [${r.wo_tools.join(' → ')}]`);
      console.log(`    With MM: [${r.w_tools.join(' → ')}]`);
    }
  }

  // Save
  fs.writeFileSync('./accuracy-results.json', JSON.stringify({
    total: results.length,
    memoryServed: mem.length,
    accuracy: {
      all: { exact: results.filter(r=>r.exactMatch).length, core: results.filter(r=>r.coreMatch).length, overlap: results.filter(r=>r.anyOverlap).length },
      memoryOnly: { exact: memExact, core: memCore, overlap: memOverlap },
    },
    details: results.map(r => ({ p: r.pattern, q: r.query.slice(0, 60), wo: r.wo_tools, w: r.w_tools, ph: r.w_phase, ex: r.exactMatch, co: r.coreMatch })),
  }, null, 2));
  console.log('\nSaved accuracy-results.json');

  for (const f of [DB, `${DB}-wal`, `${DB}-shm`]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

main().catch(err => { console.error('Failed:', err.message); process.exit(1); });
