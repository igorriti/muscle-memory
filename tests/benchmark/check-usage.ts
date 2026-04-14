import 'dotenv/config';
import { openai } from '@ai-sdk/openai';
import { generateText, tool } from 'ai';
import { z } from 'zod';

async function main() {
  const result = await generateText({
    model: openai.chat('gpt-5.4'),
    tools: { test: tool({ description: 'test', inputSchema: z.object({ x: z.string() }), execute: async () => ({ ok: true }) }) },
    prompt: 'Call test with x=hello',
    maxSteps: 3,
  });
  console.log('usage:', JSON.stringify(result.usage, null, 2));
  console.log('totalUsage:', JSON.stringify((result as any).totalUsage, null, 2));
  console.log('steps usage:', result.steps?.map(s => JSON.stringify((s as any).usage)));
}
main().catch(console.error);
