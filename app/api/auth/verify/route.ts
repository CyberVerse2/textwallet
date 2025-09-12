import { NextRequest, NextResponse } from 'next/server';
import { recoverMessageAddress } from 'viem';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, signature } = body || {};

    if (!address || !signature) {
      return NextResponse.json({ message: 'Missing parameters' }, { status: 400 });
    }

    const message = 'Sign this message to verify your address for Text Wallet.';
    const recovered = await recoverMessageAddress({ message, signature });
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json({ message: 'Signature invalid' }, { status: 401 });
    }

    return NextResponse.json({ address: recovered.toLowerCase(), verified: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: 'Verification failed' }, { status: 500 });
  }
}
