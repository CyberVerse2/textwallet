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
  id?: (number | string)[];
  slug?: string[];
  clob_token_ids?: string[];
  condition_ids?: string[];
  market_maker_address?: string[];
  liquidity_num_min?: number;
  liquidity_num_max?: number;
  volume_num_min?: number;
  volume_num_max?: number;
  start_date_min?: string; // ISO
  start_date_max?: string; // ISO
  end_date_min?: string; // ISO
  end_date_max?: string; // ISO
  tag_id?: number;
  related_tags?: boolean;
  cyom?: boolean;
  uma_resolution_status?: string;
  game_id?: string;
  sports_market_types?: string[];
  rewards_min_size?: number;
  question_ids?: string[];
  include_tag?: boolean;
  closed?: boolean;
}
