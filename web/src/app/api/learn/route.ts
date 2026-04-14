import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agent';

export async function POST() {
  try {
    const agent = getAgent();
    const result = await agent.learn();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Learn error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
