import { NextRequest, NextResponse } from 'next/server';
import { getServerWalletAddress, getUsdcBalance } from '@/lib/cdp';

export async function GET(req: NextRequest) {
  try {
    const serverAddress = await getServerWalletAddress();
    // Polygon USDC balance for server wallet
    const { balance, decimals } = await getUsdcBalance('polygon', serverAddress);

    return NextResponse.json({
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
