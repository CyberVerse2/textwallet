import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';

// Minimal helper to fetch a single Polymarket event by slug and pull clobTokenIds
async function fetchEventDetailsByUrl(url?: string) {
  try {
    if (!url) return null;
    const seg = url.includes('/event/') ? url.split('/event/')[1]?.split('?')[0] : undefined;
    if (!seg) return null;
    const base = process.env.POLYMARKET_API_BASE || 'https://gamma-api.polymarket.com';
    const u = new URL(`${base}/events`);
    u.searchParams.set('slug', seg);
    u.searchParams.set('limit', '1');
    const res = await fetch(u, { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) return null;
    const events = (await res.json()) as any[];
    const ev = Array.isArray(events) ? events[0] : null;
    if (!ev) return null;
    const markets: any[] = ev?.markets ?? [];
    const m = markets[0];
    if (!m) return null;
    const parseStrs = (s?: string | null) => {
      if (!s) return [] as string[];
      try {
        const a = JSON.parse(s);
        return Array.isArray(a) ? a.map(String) : [];
      } catch {
        return [];
      }
    };
    const outcomes = parseStrs(m.outcomes);
    const clobTokenIds = parseStrs(m.clobTokenIds);
    let yesToken: string | undefined;
    let noToken: string | undefined;
    for (let i = 0; i < outcomes.length; i++) {
      const label = String(outcomes[i] || '').toLowerCase();
      if (label === 'yes') yesToken = clobTokenIds[i];
      if (label === 'no') noToken = clobTokenIds[i];
    }
    return { title: ev?.title as string, url, tokenIds: { yes: yesToken, no: noToken } };
  } catch {
    return null;
  }
}

// Best-effort search to find the NVIDIA "largest company by market cap on Dec 31" event
async function findNvidiaEvent() {
  const base = process.env.POLYMARKET_API_BASE || 'https://gamma-api.polymarket.com';
  const u = new URL(`${base}/events`);
  u.searchParams.set('limit', '100');
  u.searchParams.set('closed', 'false');
  const res = await fetch(u, { headers: { accept: 'application/json' }, cache: 'no-store' });
  if (!res.ok) return null;
  const events = (await res.json()) as any[];
  const match = events.find((ev) => {
    const t = String(ev?.title || '').toLowerCase();
    return t.includes('nvidia') && t.includes('largest company') && t.includes('december 31');
  });
  if (!match) return null;
  const url = match?.slug ? `https://polymarket.com/event/${match.slug}` : undefined;
  return fetchEventDetailsByUrl(url);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = String(searchParams.get('userId') || '').toLowerCase();
    if (!userId) return NextResponse.json({ error: 'missing_user' }, { status: 400 });

    const ev = await findNvidiaEvent();
    if (!ev || !ev.tokenIds.yes || !ev.tokenIds.no) {
      return NextResponse.json({ positions: [], note: 'event_not_found' }, { status: 200 });
    }
    const yesId = ev.tokenIds.yes;
    const noId = ev.tokenIds.no;

    // Aggregate simple positions from our orders table
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('market_id, side, size, price, status')
      .eq('user_id', userId)
      .in('market_id', [yesId, noId]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let yesSize = 0;
    let noSize = 0;
    for (const o of data || []) {
      if (o.market_id === yesId && String(o.side).toLowerCase() === 'yes')
        yesSize += Number(o.size || 0);
      if (o.market_id === noId && String(o.side).toLowerCase() === 'no')
        noSize += Number(o.size || 0);
    }

    return NextResponse.json(
      {
        positions: [
          {
            title: ev.title,
            url: ev.url,
            tokenIds: ev.tokenIds,
            yesSize,
            noSize
          }
        ]
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'positions_failed' }, { status: 500 });
  }
}
