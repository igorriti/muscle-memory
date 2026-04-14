import 'dotenv/config';
import { openai } from '@ai-sdk/openai';
import { muscleMemory, SqliteStore } from '../../src/index.js';
import { ecommerceTools } from './tools.js';
import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';

const DB = './debug-test.db';

async function main() {
  for (const f of [DB, `${DB}-wal`, `${DB}-shm`]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  const store = new SqliteStore(DB);
  const agent = muscleMemory({
    model: openai.chat('gpt-5.4'),
    extractionModel: openai.chat('gpt-5.4-nano'),
    embeddingModel: openai.embedding('text-embedding-3-small'),
    tools: ecommerceTools,
    store,
    system: 'You are an e-commerce support agent. Use tools to help. Be concise.',
    minTraces: 3,
    confidence: 0.70,
    similarity: 0.65,
  });

  // Seed
  console.log('=== Seed ===');
  for (let i = 0; i < 5; i++) {
    await agent.run({ prompt: `Cancel my order ORD-${1000 + i}` });
  }
  await new Promise(r => setTimeout(r, 5000));

  // Learn
  const lr = await agent.learn();
  console.log('Templates created:', lr.templatesCreated);

  // Check template details
  const db = new DatabaseSync(DB);
  const templates = db.prepare('SELECT data FROM templates').all() as any[];
  for (const t of templates) {
    const tpl = JSON.parse(t.data);
    console.log(`\n=== Template: "${tpl.name}" ===`);
    console.log('  Status:', tpl.status);
    console.log('  Confidence:', tpl.confidence);
    console.log('  Embedding dims:', tpl.embedding?.length);
    console.log('  ArgSchema:', JSON.stringify(tpl.argSchema));
    console.log('  Graph nodes:', tpl.graph?.nodes?.map((n: any) => `${n.id}:${n.tool}`));
    console.log('  Graph edges:', tpl.graph?.edges?.length);
  }

  // Test matching manually
  console.log('\n=== Test queries ===');
  const testQueries = [
    'Cancel my order ORD-9999',
    'hey cancel ORD-9999 please asap',
    'i want to cancel order ORD-5555',
    'track my order ORD-1234',
  ];
  for (const q of testQueries) {
    const r = await agent.run({ prompt: q });
    console.log(`  "${q.slice(0, 40)}..." → phase=${r.phase} ${r.latencyMs}ms`);
  }

  const m = agent.metrics();
  console.log('\nFinal metrics:', JSON.stringify(m.byPhase));

  db.close();
  for (const f of [DB, `${DB}-wal`, `${DB}-shm`]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

main().catch(err => {
  console.error('FAILED:', err.message);
  console.error(err.stack?.split('\n').slice(0, 5).join('\n'));
});
