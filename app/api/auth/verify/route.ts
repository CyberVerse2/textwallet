import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, recoverMessageAddress } from 'viem';
import { base } from 'viem/chains';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, message, signature } = body || {};

    if (!address || !message || !signature) {
      return NextResponse.json({ message: 'Missing parameters' }, { status: 400 });
    }

    const client = createPublicClient({ chain: base, transport: http() });
    let valid = false;
    try {
      valid = await client.verifyMessage({ address, message, signature });
    } catch {}
    if (!valid) {
      // Fallback: recover actual signer (EOA) in case the provided address is a smart account
      try {
        const recovered = await recoverMessageAddress({ message, signature });
        if (recovered) {
          return NextResponse.json({ address: recovered.toLowerCase(), ok: true }, { status: 200 });
        }
      } catch {}
      return NextResponse.json({ message: 'Signature invalid' }, { status: 401 });
    }

    const normalized = address.toLowerCase();
    const res = NextResponse.json({ address: normalized, ok: true }, { status: 200 });
    // Set HttpOnly session cookie for 7 days
    const maxAge = 60 * 60 * 24 * 7;
    res.cookies.set('tw_session', JSON.stringify({ address: normalized }), {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge
    });
    return res;
  } catch (error) {
    return NextResponse.json({ message: 'Verification failed' }, { status: 500 });
  }
}
