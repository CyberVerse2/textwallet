import { NextRequest, NextResponse } from 'next/server';
import { getPolymarketClient } from '@/lib/polymarket/client';

export async function GET(req: NextRequest) {
  try {
    const client = getPolymarketClient();
    const { searchParams } = new URL(req.url);
    const filters: Record<string, any> = {};
    searchParams.forEach((v, k) => {
      // collect multiple values (arrays) using append style
      if (filters[k]) {
        if (Array.isArray(filters[k])) filters[k].push(v);
        else filters[k] = [filters[k], v];
      } else {
        filters[k] = v;
      }
    });
    const markets = await client.fetchMarkets(filters);
    return NextResponse.json({ markets }, { status: 200 });
  } catch (err: any) {
    console.error('Polymarket markets error:', err);
    return NextResponse.json({ error: 'Failed to fetch markets' }, { status: 500 });
  }
}
