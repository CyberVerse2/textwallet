import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { postMarketOrder } from '@/lib/polymarket/trading';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, tokenID, marketId, price, side, size, sizeUsd, tickSize, negRisk, feeRateBps } =
      body || {};

    // Resolve inputs (support swipe payloads)
    const resolvedTokenId = String(tokenID || ''); // Use tokenID for Polymarket orders
    const resolvedMarketId = String(marketId || ''); // Use marketId for database storage
    const resolvedPrice = typeof price === 'number' ? price : 0.1;
    // For market orders, compute dollar notional (amountUSD)
    let amountUSD: number | undefined = typeof sizeUsd === 'number' ? sizeUsd : undefined;
    if (amountUSD == null && typeof size === 'number') {
      amountUSD = Number((size * resolvedPrice).toFixed(2));
    }

    if (!resolvedTokenId || !side || typeof amountUSD !== 'number' || !resolvedMarketId) {
      return NextResponse.json({ error: 'missing_params' }, { status: 400 });
    }

    // Place a MARKET order (FOK) using dollar notional
    const result = await postMarketOrder({
      tokenID: resolvedTokenId,
      side,
      amountUSD,
      feeRateBps,
      price: resolvedPrice
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Record order
    let dbOrderId: string | null = null;
    console.log('[Order API] Database insertion params:', {
      userId,
      resolvedMarketId,
      resolvedTokenId,
      side,
      polymarketOrderId: String(result.order?.orderId || result.order?.id || '')
    });

    if (userId) {
      const { data, error } = await supabaseAdmin
        .from('orders')
        .insert({
          user_id: userId.toLowerCase(),
          market_id: resolvedMarketId, // Store the actual market ID
          side: String(side).toLowerCase() === 'no' ? 'no' : 'yes',
          price: resolvedPrice ?? null,
          size: 1,
          polymarket_order_id: String(result.order?.orderId || result.order?.id || ''),
          status: 'posted'
        })
        .select('id')
        .single();
      if (error) {
        console.error('[Order API] Database insertion error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          fullError: error
        });
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      dbOrderId = String(data?.id ?? '');
      console.log('[Order API] Database insertion success:', { dbOrderId });
    } else {
      console.warn('[Order API] No userId provided, skipping database insertion');
    }

    return NextResponse.json({ ok: true, order: result.order, dbOrderId }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'order_failed' }, { status: 500 });
  }
}
