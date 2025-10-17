import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { postOrder } from '@/lib/polymarket/trading';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, tokenID, marketId, price, side, size, sizeUsd, tickSize, negRisk, feeRateBps } =
      body || {};

    // Resolve inputs (support swipe payloads)
    const resolvedTokenId = String(tokenID || marketId || '');
    const resolvedPrice = typeof price === 'number' ? price : undefined;
    let resolvedSize: number | undefined = typeof size === 'number' ? size : undefined;
    if (
      !resolvedSize &&
      typeof sizeUsd === 'number' &&
      typeof resolvedPrice === 'number' &&
      resolvedPrice > 0
    ) {
      resolvedSize = Number((sizeUsd / resolvedPrice).toFixed(6));
    }

    if (
      !resolvedTokenId ||
      typeof resolvedPrice !== 'number' ||
      !side ||
      typeof resolvedSize !== 'number'
    ) {
      return NextResponse.json({ error: 'missing_params' }, { status: 400 });
    }

    // Place the Polymarket order directly (no budgets or spend permissions)`
    const result = await postOrder({
      tokenID: resolvedTokenId,
      price: resolvedPrice,
      side,
      size: resolvedSize,
      tickSize,
      negRisk,
      feeRateBps
    });
    if (!result.ok) {
      console.log(result);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Record order
    if (userId) {
      await supabaseAdmin.from('orders').insert({
        user_id: userId.toLowerCase(),
        market_id: resolvedTokenId,
        side: String(side).toLowerCase() === 'no' ? 'no' : 'yes',
        price: resolvedPrice,
        size: resolvedSize,
        polymarket_order_id: String(result.order?.orderId || result.order?.id || ''),
        status: 'posted'
      });
    }

    return NextResponse.json({ ok: true, order: result.order }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'order_failed' }, { status: 500 });
  }
}
