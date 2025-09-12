import { NextRequest, NextResponse } from 'next/server';
import { getPolymarketClient } from '@/lib/polymarket/client';

export async function GET(_req: NextRequest) {
  try {
    const client = getPolymarketClient();
    const markets = await client.fetchMarkets();
    return NextResponse.json({ markets }, { status: 200 });
  } catch (err: any) {
    console.error('Polymarket markets error:', err);
    return NextResponse.json({ error: 'Failed to fetch markets' }, { status: 500 });
  }
}
