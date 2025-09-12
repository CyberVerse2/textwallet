import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { getServerWalletAddress, getUsdcBalance } from '@/lib/cdp';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId')?.toLowerCase();
    if (!userId) return NextResponse.json({ error: 'missing_userId' }, { status: 400 });

    const [{ data: b, error: be }, { data: a, error: ae }] = await Promise.all([
      supabaseAdmin
        .from('budgets')
        .select(
          'weekly_limit_cents, remaining_cents, period_start, updated_at, permission_expires_at'
        )
        .eq('user_id', userId)
        .maybeSingle(),
      supabaseAdmin
        .from('autopilot_settings')
        .select('enabled, max_weekly_cents, updated_at')
        .eq('user_id', userId)
        .maybeSingle()
    ]);
    if (be) return NextResponse.json({ error: be.message }, { status: 500 });
    if (ae) return NextResponse.json({ error: ae.message }, { status: 500 });

    const serverAddress = await getServerWalletAddress();
    // Polygon USDC balance for server wallet
    const { balance, decimals } = await getUsdcBalance('polygon', serverAddress);

    return NextResponse.json({
      userId,
      budget: b ?? { weekly_limit_cents: 0, remaining_cents: 0 },
      autopilot: a ?? { enabled: false, max_weekly_cents: 0 },
      serverWallet: {
        address: serverAddress,
        polygonUsdc: {
          balance: balance.toString(),
          decimals
        }
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'status_failed' }, { status: 500 });
  }
}
