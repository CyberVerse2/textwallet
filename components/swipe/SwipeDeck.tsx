'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import MarketCard from '@/components/swipe/MarketCard';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { ArrowUp } from 'lucide-react';
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
    <div className="h-full flex flex-col items-center justify-center px-4 overflow-hidden">
      {loading && <div className="text-sm">Loading…</div>}
      {!loading && error && <div className="text-sm text-red-500">Failed to load markets</div>}
      {!loading && !error && (
        <div className="relative w-full max-w-md h-[65vh] md:h-[60vh] overflow-visible mx-auto">
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
                onSwipeUp={() => setMarkets((prev) => prev.filter((x) => x.id !== m.id))}
              />
            </div>
          ))}
          {markets.length === 0 && (
            <div className="text-sm text-muted-foreground">No more markets</div>
          )}
        </div>
      )}

      {/* Bottom actions */}
      <div className="mt-16 md:mt-20 flex gap-8 shrink-0 items-center">
        <Button
          variant="outline"
          className="rounded-full h-12 w-12 md:h-20 md:w-20 p-0 flex items-center justify-center border-2 border-black bg-white hover:bg-yellow/20"
          style={{ boxShadow: '4px 4px 0px 0px #000000' }}
          onClick={() => markets[0] && handleSwipe(markets[0], 'no')}
        >
          <Image src="/bad.svg" alt="No" width={28} height={28} className="md:w-10 md:h-10" />
        </Button>
        <Button
          variant="outline"
          className="rounded-full h-10 w-10 md:h-16 md:w-16 p-0 flex items-center justify-center border-2 border-black bg-white hover:bg-yellow/20"
          style={{ boxShadow: '4px 4px 0px 0px #000000' }}
          onClick={() =>
            markets[0] && setMarkets((prev) => prev.filter((x) => x.id !== markets[0].id))
          }
          aria-label="Skip"
          title="Skip"
        >
          <ArrowUp className="h-6 w-6 md:h-8 md:w-8" />
        </Button>
        <Button
          variant="outline"
          className="rounded-full h-12 w-12 md:h-20 md:w-20 p-0 flex items-center justify-center border-2 border-black bg-white hover:bg-yellow/20"
          style={{ boxShadow: '4px 4px 0px 0px #000000' }}
          onClick={() => markets[0] && handleSwipe(markets[0], 'yes')}
        >
          <Image src="/good.svg" alt="Yes" width={28} height={28} className="md:w-10 md:h-10" />
        </Button>
      </div>
    </div>
  );
}
