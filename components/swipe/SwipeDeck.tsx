'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import MarketCard from '@/components/swipe/MarketCard';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { ArrowUp, Menu, Copy as CopyIcon, Check } from 'lucide-react';
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
