'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import MarketCard from '@/components/swipe/MarketCard';
import { SwipeCard } from '@/components/swipe/SwipeCard';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { ArrowUp, Menu, Copy as CopyIcon, Check } from 'lucide-react';
import { ActionButtons } from '@/components/swipe/ActionButtons';
import { useToast } from '@/hooks/use-toast';
import { useSwipeTrades } from '@/hooks/useSwipeTrades';
import { useAccount, useConnect, useConnections } from 'wagmi';
import { getBaseAccountProvider, verifySubAccountCreated } from '@/lib/baseAccountSdk';
import { shortenAddress } from '@/lib/utils';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { Sidebar } from '@/app/client-layout';

type Market = {
  id: string;
  title: string;
  image?: string | null;
  icon?: string | null;
  endsAt?: string | null;
  volume?: number | null;
  yesPrice?: number | null;
  noPrice?: number | null;
  description?: string | null;
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
  const { address } = useAccount();
  const { connect, connectors } = useConnect();
  const connections = useConnections();
  const [displayAddress, setDisplayAddress] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/polymarket/markets?limit=10');
        const json = await res.json();
        const list: Market[] = Array.isArray(json?.markets)
          ? json.markets.map((m: any) => {
              // Parse outcomes/prices for YES/NO
              const outcomesRaw = m.outcomes;
              const pricesRaw = m.outcomePrices;
              let outcomes: string[] = [];
              let prices: number[] = [];
              if (Array.isArray(outcomesRaw)) outcomes = outcomesRaw.map((x: any) => String(x));
              else if (typeof outcomesRaw === 'string') {
                try {
                  outcomes = JSON.parse(outcomesRaw);
                } catch {}
              }
              if (Array.isArray(pricesRaw)) prices = pricesRaw.map((x: any) => Number(x));
              else if (typeof pricesRaw === 'string') {
                try {
                  prices = JSON.parse(pricesRaw).map((x: any) => Number(x));
                } catch {}
              }
              let yesPrice: number | null = null;
              let noPrice: number | null = null;
              if (outcomes.length === 2 && prices.length === 2) {
                const iYes = outcomes.findIndex((o) => o?.toLowerCase() === 'yes');
                const iNo = outcomes.findIndex((o) => o?.toLowerCase() === 'no');
                if (iYes > -1) yesPrice = Number(prices[iYes]);
                if (iNo > -1) noPrice = Number(prices[iNo]);
              }
              return {
                id: String(m.id || m.marketId || crypto.randomUUID()),
                title: m.title || m.question,
                image: m.image || m.icon || null,
                icon: m.icon || null,
                endsAt: m.endDate || null,
                volume:
                  typeof m.volume === 'number'
                    ? m.volume
                    : Number(m.volume) || Number(m.volumeNum) || Number(m.volumeClob) || null,
                yesPrice:
                  typeof yesPrice === 'number' && isFinite(yesPrice)
                    ? yesPrice
                    : typeof m.bestAsk === 'number'
                    ? m.bestAsk
                    : Number(m.bestAsk) || null,
                noPrice:
                  typeof noPrice === 'number' && isFinite(noPrice)
                    ? noPrice
                    : typeof m.bestBid === 'number'
                    ? 1 - m.bestBid
                    : isFinite(Number(m.bestBid))
                    ? 1 - Number(m.bestBid)
                    : null,
                description: typeof m.description === 'string' ? m.description : null
              } as Market;
            })
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

  useEffect(() => {
    try {
      const flat = connections.flatMap((c) => (c as any).accounts as string[]);
      const [sub] = flat;
      setDisplayAddress((sub as any) ?? address ?? null);
    } catch {
      setDisplayAddress(address ?? null);
    }
  }, [connections, address]);

  useEffect(() => {
    let abort = false;
    const fetchUsdc = async () => {
      try {
        if (!displayAddress) {
          setUsdcBalance(null);
          return;
        }
        const res = await fetch(`/api/usdc-balance?address=${displayAddress}`, {
          cache: 'no-store'
        });
        if (!res.ok) throw new Error('usdc_balance_failed');
        const json = await res.json();
        if (abort) return;
        const raw = BigInt(json.balance);
        const decimals = Number(json.decimals ?? 6);
        const amount = Number(raw) / 10 ** decimals;
        const formatted = Math.floor(amount).toLocaleString(undefined, {
          maximumFractionDigits: 0
        });
        setUsdcBalance(`${formatted} USDC`);
      } catch {
        if (!abort) setUsdcBalance(null);
      }
    };
    fetchUsdc();
    return () => {
      abort = true;
    };
  }, [displayAddress]);

  // Prefetch when low
  useEffect(() => {
    const prefetch = async () => {
      if (loading || markets.length >= 3) return;
      try {
        const res = await fetch('/api/polymarket/markets?limit=10');
        const json = await res.json();
        const list: Market[] = Array.isArray(json?.markets)
          ? json.markets.map((m: any) => {
              const outcomesRaw = m.outcomes;
              const pricesRaw = m.outcomePrices;
              let outcomes: string[] = [];
              let prices: number[] = [];
              if (Array.isArray(outcomesRaw)) outcomes = outcomesRaw.map((x: any) => String(x));
              else if (typeof outcomesRaw === 'string') {
                try {
                  outcomes = JSON.parse(outcomesRaw);
                } catch {}
              }
              if (Array.isArray(pricesRaw)) prices = pricesRaw.map((x: any) => Number(x));
              else if (typeof pricesRaw === 'string') {
                try {
                  prices = JSON.parse(pricesRaw).map((x: any) => Number(x));
                } catch {}
              }
              let yesPrice: number | null = null;
              let noPrice: number | null = null;
              if (outcomes.length === 2 && prices.length === 2) {
                const iYes = outcomes.findIndex((o) => o?.toLowerCase() === 'yes');
                const iNo = outcomes.findIndex((o) => o?.toLowerCase() === 'no');
                if (iYes > -1) yesPrice = Number(prices[iYes]);
                if (iNo > -1) noPrice = Number(prices[iNo]);
              }
              return {
                id: String(m.id || m.marketId || crypto.randomUUID()),
                title: m.title || m.question,
                image: m.image || m.icon || null,
                icon: m.icon || null,
                endsAt: m.endDate || null,
                volume:
                  typeof m.volume === 'number'
                    ? m.volume
                    : Number(m.volume) || Number(m.volumeNum) || Number(m.volumeClob) || null,
                yesPrice:
                  typeof yesPrice === 'number' && isFinite(yesPrice)
                    ? yesPrice
                    : typeof m.bestAsk === 'number'
                    ? m.bestAsk
                    : Number(m.bestAsk) || null,
                noPrice:
                  typeof noPrice === 'number' && isFinite(noPrice)
                    ? noPrice
                    : typeof m.bestBid === 'number'
                    ? 1 - m.bestBid
                    : isFinite(Number(m.bestBid))
                    ? 1 - Number(m.bestBid)
                    : null,
                description: typeof m.description === 'string' ? m.description : null
              } as Market;
            })
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
    <div className="h-full flex flex-col items-center justify-start px-4 overflow-hidden">
      {/* Wallet header becomes part of main flow */}
      <div className="w-full mb-4 md:mb-16">
        <div
          className="bg-white rounded-xl border-2 border-black p-3 flex items-center justify-between gap-3"
          style={{ boxShadow: '4px 4px 0px 0px #000000' }}
        >
          {displayAddress ? (
            <>
              {/* Left: address */}
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold">{shortenAddress(displayAddress)}</div>
                <button
                  className="p-1 border-2 border-black rounded-md hover:bg-yellow/20"
                  title="Copy address"
                  onClick={() => {
                    try {
                      navigator.clipboard.writeText(displayAddress);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1200);
                    } catch {}
                  }}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <CopyIcon className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              {/* Middle: USDC icon + balance */}
              <div className="flex-1 flex items-center justify-center gap-2 text-xs font-bold">
                <Image
                  src="/usdc.svg"
                  alt="USDC"
                  width={25}
                  height={25}
                  style={{ boxShadow: '2px 2px 0px 0px #000000', borderRadius: '50%' }}
                />
                <span>{usdcBalance || '—'}</span>
              </div>
              {/* Right-side menu handled below */}
            </>
          ) : (
            <Button
              variant="outline"
              className="w-full justify-center border-2 border-black rounded-xl font-bold"
              style={{ boxShadow: '2px 2px 0px 0px #000000' }}
              onClick={async () => {
                try {
                  const provider = getBaseAccountProvider();
                  await provider.request({ method: 'wallet_connect', params: [] });
                  await provider.request({ method: 'eth_requestAccounts', params: [] });
                  await verifySubAccountCreated();
                } catch {}
                const baseConnector =
                  connectors.find((c) => (c.name || '').toLowerCase().includes('base')) ??
                  connectors[0];
                if (baseConnector) connect({ connector: baseConnector });
              }}
            >
              Sign In
            </Button>
          )}
          {/* Top up button links to Circle faucet */}
          {displayAddress && (
            <a
              href="https://faucet.circle.com"
              target="_blank"
              rel="noreferrer"
              className="ml-2"
              title="Top up USDC"
            >
              <Button
                variant="outline"
                className="h-9 px-3 text-xs border-2 border-black rounded-lg"
                style={{ boxShadow: '2px 2px 0px 0px #000000' }}
              >
                Top Up
              </Button>
            </a>
          )}
          {/* Menu button sits inside the header on mobile */}
          <Drawer>
            <DrawerTrigger asChild>
              <Button
                variant="outline"
                className="border-2 border-black rounded-xl font-bold h-9 w-9 p-0"
                style={{ boxShadow: '2px 2px 0px 0px #000000' }}
                aria-label="Menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="h-[90dvh] md:h-[90dvh]">
              <div className="p-4 h-full overflow-y-auto md:flex md:items-stretch md:justify-center">
                <div className="w-full md:w-auto md:h-full">
                  <Sidebar ref={{ current: null } as any} />
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </div>
      {loading && <div className="text-sm">Loading…</div>}
      {!loading && error && <div className="text-sm text-red-500">Failed to load markets</div>}
      {!loading && !error && (
        <div className="relative w-full max-w-md h-[65vh] md:h-[60vh] overflow-visible mx-auto">
          {markets.slice(0, 3).map((m, i) => {
            const yesAmount =
              typeof m.yesPrice === 'number' && isFinite(m.yesPrice)
                ? `$${(2 / Math.max(0.01, m.yesPrice)).toFixed(2)}`
                : '—';
            const noAmount =
              typeof m.noPrice === 'number' && isFinite(m.noPrice)
                ? `$${(2 / Math.max(0.01, m.noPrice)).toFixed(2)}`
                : '—';
            const yesPriceStr =
              typeof m.yesPrice === 'number' ? `${(m.yesPrice * 100).toFixed(1)}¢` : '—';
            const noPriceStr =
              typeof m.noPrice === 'number' ? `${(m.noPrice * 100).toFixed(1)}¢` : '—';
            const formatAbbrev = (n?: number | null) => {
              if (!n || !isFinite(n)) return undefined;
              if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}b`;
              if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
              if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
              return `${Math.round(n)}`;
            };
            const card = {
              id: i,
              logo: (m.title?.[0] || 'M').toUpperCase(),
              logoUrl: m.image || m.icon || undefined,
              logoColor: 'bg-blue-400',
              question: m.title,
              description: m.description || '',
              yesAmount,
              yesPrice: yesPriceStr,
              noAmount,
              noPrice: noPriceStr,
              endDate: m.endsAt ? new Date(m.endsAt).toLocaleDateString() : '',
              volume: m.volume ? `$${formatAbbrev(m.volume)}` : undefined
            } as const;
            return (
              <div
                key={m.id}
                className="absolute inset-0"
                style={{ transform: `translateY(${i * 12}px) scale(${1 - i * 0.03})` }}
              >
                <SwipeCard
                  card={card}
                  onSwipe={(direction) => {
                    if (direction === 'left') return handleSwipe(m, 'no');
                    if (direction === 'right') return handleSwipe(m, 'yes');
                    // up => skip
                    setMarkets((prev) => prev.filter((x) => x.id !== m.id));
                  }}
                />
              </div>
            );
          })}
          {markets.length === 0 && (
            <div className="text-sm text-muted-foreground">No more markets</div>
          )}
        </div>
      )}

      {/* Bottom actions */}
      <div className="mt-16 md:mt-20 shrink-0">
        <ActionButtons
          onNo={() => markets[0] && handleSwipe(markets[0], 'no')}
          onSkip={() =>
            markets[0] && setMarkets((prev) => prev.filter((x) => x.id !== markets[0].id))
          }
          onYes={() => markets[0] && handleSwipe(markets[0], 'yes')}
        />
      </div>
    </div>
  );
}
