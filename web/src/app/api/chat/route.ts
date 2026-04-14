import { NextRequest, NextResponse } from 'next/server';
import { getAgent } from '@/lib/agent';

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const agent = getAgent();
    const result = await agent.run({ prompt: message });

    return NextResponse.json({
      text: result.text,
      phase: result.phase,
      traceId: result.traceId,
      latencyMs: result.latencyMs,
      costUsd: result.costUsd,
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
