import type {
  PolymarketClientConfig,
  PolymarketRawMarket,
  NormalizedMarket,
  PolymarketEventFilters
} from './types';

export class PolymarketClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(config: PolymarketClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? 'https://gamma-api.polymarket.com';
    this.apiKey = config.apiKey;
  }

  async fetchMarkets(filters?: PolymarketEventFilters): Promise<NormalizedMarket[]> {
    const url = new URL(`${this.baseUrl}/events`);
    if (filters) {
      const params = url.searchParams;
      for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          for (const v of value) params.append(key, String(v));
        } else {
          params.set(key, String(value));
        }
      }
    }
    let res = await fetch(url, {
      headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined,
      cache: 'no-store'
    });
    if (!res.ok) {
      if (res.status === 422) {
        try {
          const detail = await res.text();
          console.error('Polymarket /events 422:', { url: url.toString(), detail });
        } catch {}
        // Retry: remove strict params that often cause 422
        const retryUrl = new URL(`${this.baseUrl}/events`);
        for (const [k, v] of url.searchParams.entries()) {
          if (k === 'end_date_min' || k === 'order' || k === 'ascending') continue;
          retryUrl.searchParams.append(k, v);
        }
        res = await fetch(retryUrl, {
          headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined,
          cache: 'no-store'
        });
      }
      if (!res.ok) {
        throw new Error(`Polymarket API error: ${res.status}`);
      }
    }
    const events = (await res.json()) as any[];
    const normalized: NormalizedMarket[] = [];
    for (const ev of events) {
      const title: string = ev?.title ?? ev?.name ?? 'Untitled';
      const url: string | null = ev?.slug ? `https://polymarket.com/event/${ev.slug}` : null;
      // event-level volume is not consistent; prefer market-level volumes below
      const endsAt: string | null = ev?.endDate ?? null;
      const markets: any[] = Array.isArray(ev?.markets) ? ev.markets : [];
      const isFeatured = Boolean(ev?.featured);
      for (const m of markets) {
        const bestBid = this.num(m?.bestBid);
        const bestAsk = this.num(m?.bestAsk);
        const lastPrice = this.num(m?.lastTradePrice);
        const liquidityNum = this.num(m?.liquidityNum);
        const liquidity = liquidityNum ?? this.num(m?.liquidity) ?? 0;
        const marketVol =
          this.num((m as any)?.volume24hr) ?? this.num(m?.volumeNum) ?? this.num(m?.volume) ?? 0;
        const normalizedMarket: NormalizedMarket = {
          id: String(m?.id ?? ev?.id),
          title: m?.question ?? title,
          url,
          bestBid,
          bestAsk,
          lastPrice,
          liquidity,
          volume24h: marketVol,
          endsAt,
          score: 0,
          featured: isFeatured
        };
        normalized.push({
          ...normalizedMarket,
          score: this.computeUpsideScore(normalizedMarket)
        });
      }
    }
    return normalized.sort((a, b) => b.score - a.score);
  }

  private num(x: any): number | null {
    if (x === null || x === undefined) return null;
    const n = typeof x === 'string' ? parseFloat(x) : Number(x);
    return Number.isFinite(n) ? n : null;
  }

  private computeUpsideScore(m: NormalizedMarket): number {
    const ask = typeof m.bestAsk === 'number' ? m.bestAsk : m.lastPrice ?? 0.5;
    const upside = Math.max(0, 1 - ask);
    // Weight by log liquidity to avoid tiny pools dominating
    const liqWeight = Math.log10(Math.max(1, m.liquidity));
    return upside * (1 + liqWeight);
  }
}

export function getPolymarketClient(): PolymarketClient {
  return new PolymarketClient({
    baseUrl: process.env.POLYMARKET_API_BASE,
    apiKey: process.env.POLYMARKET_API_KEY
  });
}
