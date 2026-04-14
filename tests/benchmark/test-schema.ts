import 'dotenv/config';
import { openai } from '@ai-sdk/openai';
import { generateText, tool } from 'ai';
import { z } from 'zod';

async function main() {
  // Quick test: v6 uses inputSchema, not parameters
  const result = await generateText({
    model: openai.chat('gpt-5.4'),
    tools: {
      get_order: tool({
        description: 'Get order details',
        inputSchema: z.object({ order_id: z.string().describe('Order ID') }),
        execute: async ({ order_id }) => ({ order_id, status: 'processing' }),
      }),
    },
    prompt: 'Get order ORD-1234',
    maxSteps: 3,
  });
  console.log('Result:', result.text?.slice(0, 200));
  const toolCalls = result.steps?.flatMap(s => s.toolCalls ?? []).map(tc => tc.toolName);
  console.log('Tool calls:', toolCalls);
}

main().catch(console.error);
