import { NextResponse } from 'next/server';
import { getServerWalletAddress } from '@/lib/cdp';

export async function GET() {
  try {
    const address = await getServerWalletAddress();
    return NextResponse.json({ address });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to get server wallet' },
      { status: 500 }
    );
  }
}
