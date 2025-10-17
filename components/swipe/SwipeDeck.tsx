'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import MarketCard from './MarketCard';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSwipeTrades } from '@/hooks/useSwipeTrades';

type Market = {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
};

const SWIPE_SIZE_USD = 2;
const SLIPPAGE = 0.01;

export default function SwipeDeck() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const { toast } = useToast();
  const { submit } = useSwipeTrades();

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/polymarket/markets?limit=10');
        const json = await res.json();
        const list: Market[] = Array.isArray(json?.markets)
          ? json.markets.map((m: any) => ({
              id: m.id || m.marketId || String(Math.random()),
              title: m.title || m.question,
              subtitle: m.subtitle,
              icon: m.icon
            }))
          : [];
        setMarkets(list);
      } catch (e: any) {
        setError(e?.message || 'failed');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  // Prefetch when low
  useEffect(() => {
    const prefetch = async () => {
      if (loading || markets.length >= 3) return;
      try {
        const res = await fetch('/api/polymarket/markets?limit=10');
        const json = await res.json();
        const list: Market[] = Array.isArray(json?.markets)
          ? json.markets.map((m: any) => ({
              id: m.id || m.marketId || String(Math.random()),
              title: m.title || m.question,
              subtitle: m.subtitle,
              icon: m.icon
            }))
          : [];
        setMarkets((prev) => [...prev, ...list]);
      } catch {}
    };
    prefetch();
  }, [markets, loading]);

  const handleSwipe = async (market: Market, side: 'yes' | 'no') => {
    if (cooldown) return;
    setCooldown(true);
    setTimeout(() => setCooldown(false), 1000);
    await submit(market, side, SWIPE_SIZE_USD, SLIPPAGE);
    setMarkets((prev) => prev.filter((m) => m.id !== market.id));
  };

  return (
    <div className="h-full flex flex-col items-center justify-center px-4">
      {loading && <div className="text-sm">Loading…</div>}
      {!loading && error && <div className="text-sm text-red-500">Failed to load markets</div>}
      {!loading && !error && (
        <div className="relative w-full max-w-md h-[70vh]">
          {markets.slice(0, 3).map((m, i) => (
            <div
              key={m.id}
              className="absolute inset-0"
              style={{ transform: `translateY(${i * 12}px) scale(${1 - i * 0.03})` }}
            >
              <MarketCard
                market={m}
                onSwipeLeft={() => handleSwipe(m, 'no')}
                onSwipeRight={() => handleSwipe(m, 'yes')}
              />
            </div>
          ))}
          {markets.length === 0 && (
            <div className="text-sm text-muted-foreground">No more markets</div>
          )}
        </div>
      )}

      {/* Bottom actions (mobile) */}
      <div className="mt-4 flex gap-4">
        <Button
          variant="outline"
          className="rounded-full h-12 w-12"
          onClick={() => markets[0] && handleSwipe(markets[0], 'no')}
        >
          ✕
        </Button>
        <Button
          variant="outline"
          className="rounded-full h-12 w-12"
          onClick={() => setMarkets((p) => [...p.slice(1), p[0]].filter(Boolean))}
        >
          ⟳
        </Button>
        <Button
          variant="outline"
          className="rounded-full h-12 w-12"
          onClick={() => markets[0] && handleSwipe(markets[0], 'yes')}
        >
          ✓
        </Button>
      </div>
    </div>
  );
}
