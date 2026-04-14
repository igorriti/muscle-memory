import 'dotenv/config';
(globalThis as any).AI_SDK_LOG_WARNINGS = false;
import { openai } from '@ai-sdk/openai';
import { muscleMemory, SqliteStore } from '../../src/index.js';
import { ecommerceTools } from './tools.js';
import { PATTERN_NAMES, makeQuery } from './queries.js';
import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';

const DB = './debug-match.db';

async function main() {
  for (const f of [DB, `${DB}-wal`, `${DB}-shm`]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  const agent = muscleMemory({
    model: openai.chat('gpt-5.4'),
    extractionModel: openai.chat('gpt-5.4-nano'),
    embeddingModel: openai.embedding('text-embedding-3-small'),
    tools: ecommerceTools,
    store: new SqliteStore(DB),
    system: 'You are an e-commerce support agent. Use tools to help. Be concise.',
    minTraces: 3,
    confidence: 0.70,
    similarity: 0.65,
  });

  // Seed: 5 queries per pattern
  console.log('=== Seeding 5 per pattern ===');
  for (const pattern of PATTERN_NAMES) {
    for (let i = 0; i < 5; i++) {
      await agent.run({ prompt: makeQuery(pattern, i) });
    }
    process.stdout.write('.');
  }
  console.log(' done');

  await new Promise(r => setTimeout(r, 5000));
  await agent.learn();

  // Check templates
  const db = new DatabaseSync(DB);
  const templates = db.prepare('SELECT data FROM templates').all() as any[];

  console.log(`\n=== ${templates.length} TEMPLATES ===\n`);
  for (const t of templates) {
    const tpl = JSON.parse(t.data);
    const tools = tpl.graph.nodes.map((n: any) => n.tool).join(' → ');
    console.log(`  "${tpl.name}" → [${tools}]`);
  }

  // Now test one query from each pattern and see which template matches
  console.log('\n=== MATCHING TEST (1 query per pattern) ===\n');

  const testQueries = PATTERN_NAMES.map(p => ({
    pattern: p,
    query: makeQuery(p, 99), // use index 99 for fresh queries
  }));

  for (const { pattern, query } of testQueries) {
    // Run through without MM to see correct tools
    const { generateText } = await import('ai');
    const woResult = await generateText({
      model: openai.chat('gpt-5.4'),
      system: 'You are an e-commerce support agent. Use tools to help. Be concise.',
      tools: ecommerceTools,
      prompt: query,
      maxSteps: 10,
    });
    const woTools = woResult.steps?.flatMap(s => s.toolCalls ?? []).map(tc => tc.toolName) ?? [];

    // Run through with MM
    const wResult = await agent.run({ prompt: query });
    let wTools: string[] = [];
    if (wResult.phase === 3) {
      try {
        const parsed = JSON.parse(wResult.text);
        if (Array.isArray(parsed)) wTools = parsed.map((e: any) => e.tool).filter(Boolean);
      } catch {}
    } else {
      wTools = woTools; // Phase 1 = same as without
    }

    const match = woTools.join(',') === wTools.join(',');
    const icon = wResult.phase === 3 ? (match ? '✓' : '✗') : '○';
    console.log(`  ${icon} [${pattern}] phase=${wResult.phase} "${query.slice(0, 45)}..."`);
    if (wResult.phase === 3) {
      console.log(`      Expected: [${woTools.join(' → ')}]`);
      console.log(`      Got:      [${wTools.join(' → ')}]`);
      if (!match) console.log(`      MISMATCH!`);
    }
  }

  db.close();
  for (const f of [DB, `${DB}-wal`, `${DB}-shm`]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

main().catch(console.error);
