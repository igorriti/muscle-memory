import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agent';

export async function GET() {
  try {
    const agent = getAgent();
    const metrics = agent.metrics();
    return NextResponse.json(metrics);
  } catch (error: any) {
    console.error('Metrics error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
