import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { userId, amountCents, permissionExpiresAt } = await req.json();
    if (!userId || typeof amountCents !== 'number') {
      return NextResponse.json({ error: 'missing_params' }, { status: 400 });
    }
    const nowIso = new Date().toISOString();
    const upsert = await supabaseAdmin.from('budgets').upsert({
      user_id: String(userId).toLowerCase(),
      weekly_limit_cents: Math.max(0, Math.floor(amountCents)),
      remaining_cents: Math.max(0, Math.floor(amountCents)),
      period_start: nowIso,
      updated_at: nowIso,
      permission_expires_at: permissionExpiresAt || null
    });
    if (upsert.error) return NextResponse.json({ error: upsert.error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'set_failed' }, { status: 500 });
  }
}
