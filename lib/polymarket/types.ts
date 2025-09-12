export interface PolymarketRawMarket {
  id: string;
  question: string;
  url?: string;
  liquidity?: number;
  volume24h?: number;
  bestBid?: number | null;
  bestAsk?: number | null;
  lastPrice?: number | null;
  endsAt?: string | null;
}

export interface NormalizedMarket {
  id: string;
  title: string;
  url: string | null;
  bestBid: number | null;
  bestAsk: number | null;
  lastPrice: number | null;
  liquidity: number;
  volume24h: number;
  endsAt: string | null;
  score: number; // computed upside score
}

export interface PolymarketClientConfig {
  baseUrl?: string;
  apiKey?: string;
}
