import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, recoverMessageAddress } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { consumeNonce } from '@/lib/nonceStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, message, signature } = body || {};
    const clientChainId: string | number | undefined = (body || {}).chainId;
    // Prefer explicit nonce from client; fallback to parsing from SIWE message
    let { nonce } = (body || {}) as { nonce?: string };
    const cookieNonce = req.cookies.get('tw_nonce')?.value || null;
    console.debug('[auth/verify] incoming', {
      hasAddress: Boolean(address),
      hasMessage: typeof message === 'string',
      hasSignature: Boolean(signature),
      providedNonce: Boolean(nonce),
      hasCookieNonce: Boolean(cookieNonce)
    });

    if (!address || !message || !signature) {
      return NextResponse.json({ message: 'Missing parameters' }, { status: 400 });
    }

    // 1. Determine nonce if not explicitly provided
    if (!nonce) {
      // common patterns: "Nonce: <nonce>", or trailing token "at <32-hex>"
      let parsed: RegExpMatchArray | null = null;
      if (typeof message === 'string') {
        parsed = message.match(/Nonce:\s*([a-zA-Z0-9_-]{8,64})/);
        if (!parsed) {
          parsed = message.match(/at\s+([a-fA-F0-9]{32,64})\s*$/);
        }
      }
      nonce = parsed?.[1];
    }
    // 2. Validate nonce using cookie if available; otherwise fall back to shared store
    if (cookieNonce) {
      if (!nonce || nonce !== cookieNonce) {
        console.warn('[auth/verify] nonce mismatch vs cookie', { nonce, cookieNonce });
        return NextResponse.json({ message: 'Invalid or reused nonce' }, { status: 400 });
      }
      // continue; cookie will be cleared on success
    } else {
      if (!nonce || !consumeNonce(nonce)) {
        console.warn('[auth/verify] invalid or reused nonce (no cookie path)', { nonce });
        return NextResponse.json({ message: 'Invalid or reused nonce' }, { status: 400 });
      }
    }

    // Select chain based on provided chainId (supports Base Sepolia) with sensible defaults
    const isSepolia =
      String(clientChainId || '').toLowerCase() === '0x14a34' ||
      String(clientChainId || '') === String(baseSepolia.id);
    const chain = isSepolia ? baseSepolia : base;
    const defaultRpc = isSepolia ? 'https://sepolia.base.org' : 'https://mainnet.base.org';
    const rpcUrl =
      (isSepolia ? process.env.BASE_SEPOLIA_RPC_URL : process.env.BASE_RPC_URL) ||
      process.env.NEXT_PUBLIC_BASE_RPC_URL ||
      defaultRpc;
    const client = createPublicClient({ chain, transport: http(rpcUrl) });
    let valid = false;
    try {
      valid = await client.verifyMessage({ address, message, signature });
    } catch (e) {
      console.error('[auth/verify] verifyMessage threw', e);
    }
    if (!valid) {
      // Fallback: recover actual signer (EOA) in case the provided address is a smart account
      try {
        const recovered = await recoverMessageAddress({ message, signature });
        if (recovered) {
          const normalizedRecovered = recovered.toLowerCase();
          const resRecovered = NextResponse.json(
            { address: normalizedRecovered, ok: true },
            { status: 200 }
          );
          const maxAgeRecovered = 60 * 60 * 24 * 7;
          resRecovered.cookies.set('tw_session', JSON.stringify({ address: normalizedRecovered }), {
            httpOnly: true,
            path: '/',
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: maxAgeRecovered
          });
          // Clear nonce cookie
          resRecovered.cookies.set('tw_nonce', '', { httpOnly: true, path: '/', maxAge: 0 });
          return resRecovered;
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
    // Clear nonce cookie
    res.cookies.set('tw_nonce', '', { httpOnly: true, path: '/', maxAge: 0 });
    return res;
  } catch (error) {
    return NextResponse.json({ message: 'Verification failed' }, { status: 500 });
  }
}
