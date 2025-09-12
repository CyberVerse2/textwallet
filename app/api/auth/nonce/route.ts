import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { addNonce } from '@/lib/nonceStore';

export async function GET() {
  const nonce = crypto.randomBytes(16).toString('hex');
  addNonce(nonce);
  const res = new NextResponse(nonce, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' }
  });
  // Mirror nonce into HttpOnly cookie to avoid cross-instance mismatches
  res.cookies.set('tw_nonce', nonce, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 5
  });
  return res;
}
