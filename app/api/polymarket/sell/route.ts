import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { postMarketOrder } from '@/lib/polymarket/trading';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, marketId, side, size, source } = body || {};

    if (!userId || !marketId || !side || typeof size !== 'number' || size <= 0) {
      return NextResponse.json({ error: 'missing_params' }, { status: 400 });
    }

    // For selling, we need to flip the side (YES becomes NO, NO becomes YES)
    const sellSide = side.toLowerCase() === 'yes' ? 'no' : 'yes';

    // Use market price for selling (0.1 as default, will be filled at best available price)
    const marketPrice = 0.1;

    // Place a MARKET order to sell the position
    const result = await postMarketOrder({
      tokenID: marketId, // Using marketId as tokenID for now
      side: sellSide,
      amountUSD: size,
      price: marketPrice
    });

    if (!result.ok) {
      console.log('Polymarket sell order failed:', result);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Record the sell order in Supabase
    let dbOrderId: string | null = null;
    const { data, error } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: userId.toLowerCase(),
        market_id: marketId,
        side: sellSide,
        price: marketPrice,
        size: size,
        polymarket_order_id: String(result.order?.orderId || result.order?.id || ''),
        status: 'posted',
        source: source || 'positions-drawer'
      })
      .select('id')
      .single();

    if (error) {
      console.error('Supabase insert failed:', error);
      return NextResponse.json({ error: error.message || 'db_insert_failed' }, { status: 500 });
    }
    dbOrderId = String(data?.id ?? '');

    return NextResponse.json(
      {
        ok: true,
        order: result.order,
        dbOrderId,
        message: 'Position sold successfully'
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error('Sell API error:', e);
    return NextResponse.json({ error: e?.message || 'sell_failed' }, { status: 500 });
  }
}
