import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { postOrder } from '@/lib/polymarket/trading';
import { spendFromPermission } from '@/lib/base/spend';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, tokenID, price, side, size, tickSize, negRisk, feeRateBps } = body || {};
    if (!userId || !tokenID || typeof price !== 'number' || !side || typeof size !== 'number') {
      return NextResponse.json({ error: 'missing_params' }, { status: 400 });
    }

    // Charge budget first based on cost in cents
    const costCents = Math.round(size * price * 100);
    const { data: budgetRow, error: budgetErr } = await supabaseAdmin
      .from('budgets')
      .select('remaining_cents')
      .eq('user_id', userId.toLowerCase())
      .maybeSingle();
    if (budgetErr) return NextResponse.json({ error: budgetErr.message }, { status: 500 });
    const remaining = budgetRow?.remaining_cents ?? 0;
    if (remaining < costCents)
      return NextResponse.json({ error: 'insufficient_budget' }, { status: 402 });

    const { error: updErr } = await supabaseAdmin
      .from('budgets')
      .update({ remaining_cents: remaining - costCents })
      .eq('user_id', userId.toLowerCase());
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    // Pull USDC from user's Base account to server wallet via spend permission (no bridge)
    const usdcUnits = BigInt(Math.round(size * price * 1_000_000));
    const spend = await spendFromPermission(userId, usdcUnits);
    if (!spend.ok) {
      // Refund on failure
      await supabaseAdmin
        .from('budgets')
        .update({ remaining_cents: remaining })
        .eq('user_id', userId.toLowerCase());
      return NextResponse.json({ error: spend.error || 'spend_failed' }, { status: 500 });
    }

    // Place the Polymarket order
    const result = await postOrder({ tokenID, price, side, size, tickSize, negRisk, feeRateBps });
    if (!result.ok) {
      // Refund on failure
      await supabaseAdmin
        .from('budgets')
        .update({ remaining_cents: remaining })
        .eq('user_id', userId.toLowerCase());
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Record order
    await supabaseAdmin.from('orders').insert({
      user_id: userId.toLowerCase(),
      market_id: tokenID,
      side: String(side).toLowerCase() === 'no' ? 'no' : 'yes',
      price,
      size,
      polymarket_order_id: String(result.order?.orderId || result.order?.id || ''),
      status: 'posted'
    });

    return NextResponse.json({ ok: true, order: result.order }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'order_failed' }, { status: 500 });
  }
}
