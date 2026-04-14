import { muscleMemory, SqliteStore } from 'muscle-memory';
import { openai } from '@ai-sdk/openai';
import { tool } from 'ai';
import { z } from 'zod';

// Tools that simulate a real e-commerce backend
const tools = {
  get_order: tool({
    description: 'Get order details by ID',
    parameters: z.object({ order_id: z.string().describe('The order ID') }),
    execute: async ({ order_id }) => ({
      order_id,
      status: 'processing',
      customer_email: 'customer@example.com',
      total: 59.99,
      items: ['Widget A', 'Widget B'],
    }),
  }),
  cancel_order: tool({
    description: 'Cancel an order',
    parameters: z.object({ order_id: z.string().describe('The order ID') }),
    execute: async ({ order_id }) => ({
      order_id,
      cancelled: true,
    }),
  }),
  process_refund: tool({
    description: 'Process a refund for an order',
    parameters: z.object({ order_id: z.string().describe('The order ID') }),
    execute: async ({ order_id }) => ({
      order_id,
      refund_amount: 59.99,
      status: 'initiated',
    }),
  }),
  send_notification: tool({
    description: 'Send email notification',
    parameters: z.object({
      email: z.string().describe('Recipient email'),
      subject: z.string().describe('Subject'),
      body: z.string().describe('Body'),
    }),
    execute: async ({ email, subject }) => ({
      sent: true,
      to: email,
      subject,
    }),
  }),
  get_shipping_status: tool({
    description: 'Get shipping status for an order',
    parameters: z.object({ order_id: z.string().describe('The order ID') }),
    execute: async ({ order_id }) => ({
      order_id,
      status: 'in_transit',
      carrier: 'FedEx',
      tracking: '1Z999AA10123456784',
      estimated_delivery: '2026-04-18',
    }),
  }),
  track_shipment: tool({
    description: 'Track a shipment by tracking number',
    parameters: z.object({ tracking_number: z.string().describe('Tracking number') }),
    execute: async ({ tracking_number }) => ({
      tracking_number,
      current_location: 'Distribution Center, Chicago IL',
      status: 'in_transit',
      last_update: '2026-04-14T10:30:00Z',
    }),
  }),
};

// Singleton agent
let _agent: ReturnType<typeof muscleMemory> | null = null;

export function getAgent() {
  if (!_agent) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    _agent = muscleMemory({
      model: openai('gpt-4.1-mini'),
      extractionModel: openai('gpt-4.1-nano'),
      embeddingModel: openai('text-embedding-3-small'),
      tools,
      store: new SqliteStore('./muscle-memory.db'),
      system: 'You are a customer support agent for an e-commerce store. Use the available tools to help customers. Be concise and helpful. Always confirm what action you took.',
    });
  }
  return _agent;
}
