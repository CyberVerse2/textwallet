import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = String(searchParams.get('userId') || '').toLowerCase();
    const limit = Math.min(parseInt(String(searchParams.get('limit') || '20'), 10) || 20, 50);
    if (!userId) return NextResponse.json({ error: 'missing_user' }, { status: 400 });

    const [orders, perms] = await Promise.all([
      supabaseAdmin
        .from('orders')
        .select('created_at, side, price, size, market_id, status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit),
      supabaseAdmin
        .from('spend_permissions')
        .select('created_at, token_address, allowance')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
    ]);

    const orderActs = (orders.data || []).map((o) => ({
      type: 'trade',
      description: `Market order ${String(o.side).toUpperCase()} $${Number(o.size || 0).toFixed(
        2
      )} @ ${Number(o.price || 0).toFixed(2)}`,
      timestamp: o.created_at,
      status: o.status || 'posted'
    }));

    const permActs = (perms.data || []).map((p) => ({
      type: 'permission',
      description: `Spend permission granted for ${p.token_address} (allowance ${
        Number(p.allowance || 0) / 1_000_000
      } USDC)`,
      timestamp: p.created_at,
      status: 'completed'
    }));

    const merged = [...orderActs, ...permActs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({ activities: merged.slice(0, limit) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'activity_failed' }, { status: 500 });
  }
}
