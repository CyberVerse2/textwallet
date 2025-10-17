import { NextRequest, NextResponse } from 'next/server';

// Minimal trade endpoint for swipe actions. In a later step, wire to real order placement.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { marketId, side, sizeUsd, slippage } = body || {};
    if (!marketId || (side !== 'yes' && side !== 'no')) {
      return NextResponse.json({ error: 'invalid_params' }, { status: 400 });
    }
    // TODO: call real order placement here. For now, acknowledge.
    return NextResponse.json({ ok: true, marketId, side, sizeUsd, slippage }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'trade_failed' }, { status: 500 });
  }
}
