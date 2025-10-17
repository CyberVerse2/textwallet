import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // For now, just log. Wire to storage later.
    const body = await req.json();
    console.log('analytics', body?.event, body?.payload);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
