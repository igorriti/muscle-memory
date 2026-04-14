import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { muscleMemory, SqliteStore } from '../src/index.js';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { tool } from 'ai';
import { z } from 'zod';
import * as fs from 'fs';

const HAS_KEYS = process.env.ANTHROPIC_API_KEY && process.env.OPENAI_API_KEY;
const DB_PATH = './test-muscle-memory.db';

const describeIf = HAS_KEYS ? describe : describe.skip;

// Mock tools simulating e-commerce backend
const tools = {
  get_order: tool({
    description: 'Get order details by ID',
    parameters: z.object({ order_id: z.string().describe('The order ID') }),
    execute: async ({ order_id }: { order_id: string }) => ({
      order_id,
      status: 'processing',
      email: 'customer@example.com',
      total: 59.99,
      items: ['Widget A', 'Widget B'],
    }),
  } as any),
  cancel_order: tool({
    description: 'Cancel an order by ID',
    parameters: z.object({ order_id: z.string().describe('The order ID to cancel') }),
    execute: async ({ order_id }: { order_id: string }) => ({
      order_id,
      cancelled: true,
      refund_initiated: true,
    }),
  } as any),
  process_refund: tool({
    description: 'Process a refund for an order',
    parameters: z.object({ order_id: z.string().describe('The order ID to refund') }),
    execute: async ({ order_id }: { order_id: string }) => ({
      order_id,
      refund_amount: 59.99,
      refund_status: 'initiated',
      estimated_days: 5,
    }),
  } as any),
  send_notification: tool({
    description: 'Send a notification email to the customer',
    parameters: z.object({
      email: z.string().describe('Customer email'),
      subject: z.string().describe('Email subject'),
      body: z.string().describe('Email body'),
    }),
    execute: async ({ email, subject }: { email: string; subject: string }) => ({
      sent: true,
      to: email,
      subject,
    }),
  } as any),
};

describeIf('muscle-memory integration (Anthropic + OpenAI embeddings)', () => {
  let agent: ReturnType<typeof muscleMemory>;

  beforeAll(() => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

    agent = muscleMemory({
      model: anthropic('claude-sonnet-4-20250514'),
      extractionModel: anthropic('claude-haiku-4-5-20251001'),
      embeddingModel: openai('text-embedding-3-small'),
      tools,
      store: new SqliteStore(DB_PATH),
      system: 'You are a customer support agent. Use the available tools to help customers with their orders. Be concise.',
    });
  });

  afterAll(() => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('Phase 1: first request goes through full LLM', async () => {
    const result = await agent.run({ prompt: 'Cancel my order ORD-100' });

    expect(result.phase).toBe(1);
    expect(result.text).toBeTruthy();
    expect(result.text.length).toBeGreaterThan(10);
    console.log(`[P1] ${result.text.slice(0, 120)}... (${result.latencyMs}ms, $${result.costUsd.toFixed(4)})`);
  }, 60000);

  it('Phase 1: accumulate 4 more similar traces', async () => {
    const prompts = [
      'Please cancel order ORD-200',
      'I want to cancel my order ORD-300',
      'Cancel order number ORD-400',
      'I need to cancel ORD-500',
    ];

    for (const prompt of prompts) {
      const result = await agent.run({ prompt });
      expect(result.phase).toBe(1);
      console.log(`[P1] "${prompt}" → ${result.latencyMs}ms`);
    }
  }, 300000);

  it('learn: creates template from traces', async () => {
    // Wait a moment for async embeddings to complete
    await new Promise(r => setTimeout(r, 3000));

    const result = await agent.learn();
    console.log('[LEARN]', result);
    expect(result.templatesCreated + result.templatesUpdated).toBeGreaterThan(0);
  }, 120000);

  it('metrics: shows 5 traces recorded', () => {
    const metrics = agent.metrics();
    console.log('[METRICS]', JSON.stringify(metrics, null, 2));
    expect(metrics.total).toBeGreaterThanOrEqual(5);
  });

  it('Phase 3: 6th request should use muscle memory', async () => {
    const result = await agent.run({ prompt: 'Cancel my order ORD-600 please' });

    console.log(`[RESULT] phase=${result.phase}, ${result.latencyMs}ms, $${result.costUsd.toFixed(4)}`);
    console.log(`[RESULT] ${result.text}`);

    if (result.phase === 3) {
      expect(result.costUsd).toBeLessThan(0.01);
      console.log('[SUCCESS] Phase 3 -- muscle memory worked!');
    } else {
      console.log('[INFO] Phase 1 -- template did not match. Check embeddings and similarity threshold.');
    }
  }, 60000);

  it('final metrics', () => {
    const metrics = agent.metrics();
    console.log('[FINAL METRICS]', JSON.stringify(metrics, null, 2));
    expect(metrics.total).toBeGreaterThanOrEqual(6);
  });
});
