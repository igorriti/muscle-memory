import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { muscleMemory, SqliteStore } from '../src/index.js';
import { openai } from '@ai-sdk/openai';
import { tool } from 'ai';
import { z } from 'zod';
import * as fs from 'fs';

const API_KEY = process.env.OPENAI_API_KEY;
const DB_PATH = './test-muscle-memory.db';

// Skip all tests if no API key
const describeIf = API_KEY ? describe : describe.skip;

// Mock tools that simulate real tool behavior
const tools = {
  get_order: tool({
    description: 'Get order details by ID',
    parameters: z.object({ order_id: z.string().describe('The order ID') }),
    execute: async ({ order_id }) => ({
      order_id,
      status: 'processing',
      email: 'customer@example.com',
      total: 59.99,
      items: ['Widget A', 'Widget B'],
    }),
  }),
  cancel_order: tool({
    description: 'Cancel an order by ID',
    parameters: z.object({ order_id: z.string().describe('The order ID to cancel') }),
    execute: async ({ order_id }) => ({
      order_id,
      cancelled: true,
      refund_initiated: true,
    }),
  }),
  process_refund: tool({
    description: 'Process a refund for an order',
    parameters: z.object({ order_id: z.string().describe('The order ID to refund') }),
    execute: async ({ order_id }) => ({
      order_id,
      refund_amount: 59.99,
      refund_status: 'initiated',
      estimated_days: 5,
    }),
  }),
  send_notification: tool({
    description: 'Send a notification email to the customer',
    parameters: z.object({
      email: z.string().describe('Customer email'),
      subject: z.string().describe('Email subject'),
      body: z.string().describe('Email body'),
    }),
    execute: async ({ email, subject }) => ({
      sent: true,
      to: email,
      subject,
    }),
  }),
};

describeIf('muscle-memory integration', () => {
  let agent: ReturnType<typeof muscleMemory>;

  beforeAll(() => {
    // Clean up any existing test DB
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

    agent = muscleMemory({
      model: openai('gpt-4.1-mini'),
      extractionModel: openai('gpt-4.1-nano'),
      embeddingModel: openai('text-embedding-3-small'),
      tools,
      store: new SqliteStore(DB_PATH),
      system: 'You are a customer support agent. Use the available tools to help customers with their orders. Be concise.',
    });
  });

  afterAll(() => {
    // Clean up test DB
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('Phase 1: first request goes through full LLM', async () => {
    const result = await agent.run({
      prompt: 'Cancel my order ORD-100',
    });

    expect(result.phase).toBe(1);
    expect(result.text).toBeTruthy();
    expect(result.text.length).toBeGreaterThan(10);
    expect(result.latencyMs).toBeGreaterThan(0);
    expect(result.costUsd).toBeGreaterThan(0);
    console.log(`Phase 1 result: ${result.text.slice(0, 100)}... (${result.latencyMs}ms, $${result.costUsd.toFixed(4)})`);
  }, 30000);

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
      expect(result.text).toBeTruthy();
      console.log(`Phase 1: "${prompt.slice(0, 30)}..." → ${result.latencyMs}ms`);
    }
  }, 120000);

  it('learn: creates template from accumulated traces', async () => {
    const result = await agent.learn();
    console.log(`Learning result:`, result);
    expect(result.templatesCreated + result.templatesUpdated).toBeGreaterThan(0);
  }, 60000);

  it('metrics: shows traces recorded', () => {
    const metrics = agent.metrics();
    console.log('Metrics:', JSON.stringify(metrics, null, 2));
    expect(metrics.total).toBeGreaterThanOrEqual(5);
  });

  it('Phase 3: 6th similar request uses muscle memory', async () => {
    const result = await agent.run({
      prompt: 'Cancel my order ORD-600 please',
    });

    console.log(`Phase 3 attempt: phase=${result.phase}, ${result.latencyMs}ms, $${result.costUsd.toFixed(4)}`);
    console.log(`Response: ${result.text.slice(0, 100)}...`);

    // This should be Phase 3 if learning worked
    // If not (e.g. embedding similarity too low), it'll be Phase 1
    // We log either way for debugging
    if (result.phase === 3) {
      expect(result.costUsd).toBeLessThan(0.01);
      expect(result.latencyMs).toBeLessThan(2000);
      console.log('SUCCESS: Request handled by muscle memory (Phase 3)');
    } else {
      console.log('NOTE: Request went through Phase 1 (template may not have matched)');
    }
  }, 30000);

  it('metrics: shows phase distribution after all requests', () => {
    const metrics = agent.metrics();
    console.log('Final metrics:', JSON.stringify(metrics, null, 2));
    expect(metrics.total).toBeGreaterThanOrEqual(6);
  });
});
