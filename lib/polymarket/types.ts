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

export interface PolymarketEventFilters {
  limit?: number;
  offset?: number;
  order?: string; // comma-separated
  ascending?: boolean;
  id?: number[];
  slug?: string[];
  tag_id?: number;
  exclude_tag_id?: number[];
  related_tags?: boolean;
  featured?: boolean;
  cyom?: boolean;
  include_chat?: boolean;
  include_template?: boolean;
  recurrence?: string;
  closed?: boolean;
  start_date_min?: string; // ISO
  start_date_max?: string; // ISO
  end_date_min?: string; // ISO
  end_date_max?: string; // ISO
}
