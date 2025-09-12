import { NextRequest, NextResponse } from 'next/server';
import { requestAndStoreSpendPermission } from '@/lib/base/spendPermissions';

export async function POST(req: NextRequest) {
  try {
    const { userId, account, spender, token, allowance, periodInDays } = await req.json();
    if (!userId || !account || !spender || !token || !allowance || !periodInDays) {
      return NextResponse.json({ error: 'missing_params' }, { status: 400 });
    }
    const res = await requestAndStoreSpendPermission(userId, {
      account,
      spender,
      token,
      allowance: BigInt(allowance),
      periodInDays
    });
    return NextResponse.json({ ok: true, permissionHash: res.permissionHash });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'request_failed' }, { status: 500 });
  }
}
