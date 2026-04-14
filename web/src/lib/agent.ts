import { muscleMemory, SqliteStore } from 'muscle-memory';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { tool } from 'ai';
import { z } from 'zod';

// Tools that simulate a real e-commerce backend
const tools = {
  get_order: tool({
    description: 'Get order details by ID',
    parameters: z.object({ order_id: z.string().describe('The order ID') }),
    execute: async ({ order_id }: { order_id: string }) => ({
      order_id,
      status: 'processing',
      customer_email: 'customer@example.com',
      total: 59.99,
      items: ['Widget A', 'Widget B'],
    }),
  } as any),
  cancel_order: tool({
    description: 'Cancel an order',
    parameters: z.object({ order_id: z.string().describe('The order ID') }),
    execute: async ({ order_id }: { order_id: string }) => ({
      order_id,
      cancelled: true,
    }),
  } as any),
  process_refund: tool({
    description: 'Process a refund for an order',
    parameters: z.object({ order_id: z.string().describe('The order ID') }),
    execute: async ({ order_id }: { order_id: string }) => ({
      order_id,
      refund_amount: 59.99,
      status: 'initiated',
    }),
  } as any),
  send_notification: tool({
    description: 'Send email notification',
    parameters: z.object({
      email: z.string().describe('Recipient email'),
      subject: z.string().describe('Subject'),
      body: z.string().describe('Body'),
    }),
    execute: async ({ email, subject }: { email: string; subject: string }) => ({
      sent: true,
      to: email,
      subject,
    }),
  } as any),
  get_shipping_status: tool({
    description: 'Get shipping status for an order',
    parameters: z.object({ order_id: z.string().describe('The order ID') }),
    execute: async ({ order_id }: { order_id: string }) => ({
      order_id,
      status: 'in_transit',
      carrier: 'FedEx',
      tracking: '1Z999AA10123456784',
      estimated_delivery: '2026-04-18',
    }),
  } as any),
  track_shipment: tool({
    description: 'Track a shipment by tracking number',
    parameters: z.object({ tracking_number: z.string().describe('Tracking number') }),
    execute: async ({ tracking_number }: { tracking_number: string }) => ({
      tracking_number,
      current_location: 'Distribution Center, Chicago IL',
      status: 'in_transit',
      last_update: '2026-04-14T10:30:00Z',
    }),
  } as any),
};

// Singleton agent
let _agent: ReturnType<typeof muscleMemory> | null = null;

export function getAgent() {
  if (!_agent) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    _agent = muscleMemory({
      // Phase 1: the big model (full reasoning + tool calling)
      model: anthropic('claude-sonnet-4-20250514'),
      // Phase 3: the small model (arg extraction only)
      extractionModel: anthropic('claude-haiku-4-5-20251001'),
      // Embeddings (OpenAI, cheapest option)
      embeddingModel: openai('text-embedding-3-small'),
      tools,
      store: new SqliteStore('./muscle-memory.db'),
      system: 'You are a customer support agent for an e-commerce store. Use the available tools to help customers. Be concise and helpful. Always confirm what action you took.',
    });
  }
  return _agent;
}
