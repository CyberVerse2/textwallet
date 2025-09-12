import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const {
      userId,
      permissionHash,
      permission,
      token,
      allowance,
      periodSeconds,
      startUnix,
      endUnix
    } = await req.json();
    if (!userId || !permission || !token || allowance == null || !periodSeconds) {
      return NextResponse.json({ error: 'missing_params' }, { status: 400 });
    }
    const computedHash =
      permissionHash ||
      '0x' + crypto.createHash('sha256').update(JSON.stringify(permission)).digest('hex');
    const { error } = await supabaseAdmin.from('spend_permissions').upsert({
      permission_hash: String(computedHash),
      user_id: String(userId).toLowerCase(),
      token_address: String(token),
      allowance: Number(allowance),
      period_seconds: Number(periodSeconds),
      start_unix: startUnix ?? Math.floor(Date.now() / 1000),
      end_unix: endUnix ?? Math.floor(Date.now() / 1000) + Number(periodSeconds),
      permission_json: permission
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Also update budgets.permission_expires_at to align with permission end time if a budget row exists
    try {
      const effectiveEnd = endUnix ?? Math.floor(Date.now() / 1000) + Number(periodSeconds);
      await supabaseAdmin
        .from('budgets')
        .update({ permission_expires_at: new Date(effectiveEnd * 1000).toISOString() })
        .eq('user_id', String(userId).toLowerCase());
    } catch {}
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'store_failed' }, { status: 500 });
  }
}
