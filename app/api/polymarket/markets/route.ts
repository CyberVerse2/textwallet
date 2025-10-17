import { NextRequest, NextResponse } from 'next/server';

// Fetch markets from Polymarket using the events/pagination endpoint and
// filter to YES/NO markets only, ordered by volume desc.
export async function GET(req: NextRequest) {
  try {
    const incoming = new URL(req.url);
    const limit = incoming.searchParams.get('limit') || '20';
    const active = incoming.searchParams.get('active') || 'true';
    const archived = incoming.searchParams.get('archived') || 'false';
    const tag = incoming.searchParams.get('tag_slug') || 'politics';
    const closed = incoming.searchParams.get('closed') || 'false';
    const order = incoming.searchParams.get('order') || 'volume24hr';
    const ascending = incoming.searchParams.get('ascending') || 'false';
    const offset = incoming.searchParams.get('offset') || '60';

    const url = new URL('https://gamma-api.polymarket.com/events/pagination');
    // Required filters per request (match user-provided criteria)
    url.searchParams.set('limit', limit);
    url.searchParams.set('active', active);
    url.searchParams.set('archived', archived);
    url.searchParams.set('tag_slug', tag);
    url.searchParams.set('closed', closed);
    url.searchParams.set('order', order);
    url.searchParams.set('ascending', ascending);
    url.searchParams.set('offset', offset);

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`polymarket_${res.status}`);
    const json = (await res.json()) as any;
    const events: any[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];

    // Flatten YES/NO markets
    const markets = events.flatMap((ev) => {
      const evTitle: string = ev?.title ?? ev?.name ?? '';
      const inner: any[] = Array.isArray(ev?.markets) ? ev.markets : [];
      return inner
        .filter((m) => {
          const rawOut = m?.outcomes;
          let outcomes: any[] = [];
          if (Array.isArray(rawOut)) outcomes = rawOut;
          else if (typeof rawOut === 'string') {
            try {
              const parsed = JSON.parse(rawOut);
              if (Array.isArray(parsed)) outcomes = parsed;
            } catch {}
          }
          if (outcomes.length !== 2) return false;
          const o0 = String(outcomes[0] ?? '').toLowerCase();
          const o1 = String(outcomes[1] ?? '').toLowerCase();
          return (o0 === 'yes' && o1 === 'no') || (o0 === 'no' && o1 === 'yes');
        })
        .map((m) => ({
          id: String(m?.id ?? ev?.id),
          title: m?.question ?? evTitle,
          // pass through useful fields if needed later
          bestBid: typeof m?.bestBid === 'number' ? m.bestBid : Number(m?.bestBid) || null,
          bestAsk: typeof m?.bestAsk === 'number' ? m.bestAsk : Number(m?.bestAsk) || null,
          lastPrice:
            typeof m?.lastTradePrice === 'number'
              ? m.lastTradePrice
              : Number(m?.lastTradePrice) || null,
          volume24h:
            typeof m?.volume24hr === 'number' ? m.volume24hr : Number(m?.volume24hr) || null,
          ...m
        }));
    });
    console.log(markets);
    return NextResponse.json({ markets }, { status: 200 });
  } catch (err: any) {
    console.error('Polymarket markets error:', err);
    return NextResponse.json({ error: 'Failed to fetch markets' }, { status: 500 });
  }
}
