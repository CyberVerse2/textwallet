import { NextRequest, NextResponse } from 'next/server';
import { Address } from 'viem';
import { getUsdcBalance } from '@/lib/cdp';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const owner = (searchParams.get('address') || '').toLowerCase() as Address;
    if (!owner) return NextResponse.json({ error: 'Missing address' }, { status: 400 });

    const { balance, decimals } = await getUsdcBalance('base', owner);
    return NextResponse.json({ balance: balance.toString(), decimals });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
