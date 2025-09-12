import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, message, signature } = body || {};

    if (!address || !message || !signature) {
      return NextResponse.json({ message: 'Missing parameters' }, { status: 400 });
    }

    const client = createPublicClient({ chain: base, transport: http() });
    const valid = await client.verifyMessage({ address, message, signature });
    if (!valid) {
      return NextResponse.json({ message: 'Signature invalid' }, { status: 401 });
    }

    return NextResponse.json({ address: address.toLowerCase(), ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: 'Verification failed' }, { status: 500 });
  }
}
