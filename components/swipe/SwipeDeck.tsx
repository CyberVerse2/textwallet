'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import MarketCard from '@/components/swipe/MarketCard';
import { SwipeCard } from '@/components/swipe/SwipeCard';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { ArrowUp, Menu, Copy as CopyIcon, Check, X } from 'lucide-react';
import { ActionButtons } from '@/components/swipe/ActionButtons';
import { useToast } from '@/hooks/use-toast';
import { useSwipeTrades } from '@/hooks/useSwipeTrades';
import { useAccount, useConnect, useConnections, useBalance, useDisconnect } from 'wagmi';
import { getBaseAccountProvider, verifySubAccountCreated } from '@/lib/baseAccountSdk';
import { shortenAddress } from '@/lib/utils';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { WalletHeader } from '@/components/swipe/WalletHeader';
import { PositionsDrawer } from '@/components/swipe/PositionsDrawer';
import { SwipeToast } from '@/components/swipe/SwipeToast';
import { createRoot } from 'react-dom/client';
import { Sidebar } from '@/app/client-layout';
import { DisclaimerModal } from '@/components/swipe/DisclaimerModal';
import { useChatContext } from '@/context/ChatContext';

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
  const [showGuides, setShowGuides] = useState(true);
  const [isPositionsOpen, setIsPositionsOpen] = useState(false);
  const { toast } = useToast();
  const { submit } = useSwipeTrades();
  const { address } = useAccount();
  const { connect, connectors } = useConnect();
  const connections = useConnections();
  const { disconnect } = useDisconnect();
  const [copied, setCopied] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set());

  // Use ChatContext for wallet state
  const { isWalletConnected, walletAddress, setIsWalletConnected, setWalletAddress } =
    useChatContext();

  // Load swiped market ids
  useEffect(() => {
    try {
      const raw = localStorage.getItem('tw_swiped_markets');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setSwipedIds(new Set(arr.map((x: any) => String(x))));
      }
    } catch {}
  }, []);

  const persistSwipedId = (id: string) => {
    setSwipedIds((prev) => {
      const next = new Set(prev);
      next.add(String(id));
      try {
        localStorage.setItem('tw_swiped_markets', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };
  // Base Sepolia USDC
  const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;

  // Derive sub and universal accounts from Base Account connection
  const [subAccountAddr, universalAccountAddr] = useMemo(() => {
    try {
      const flat = connections.flatMap((c) => (c as any).accounts as string[]);
      const sub = flat?.[0] ?? address ?? null;
      const uni = flat?.[1] ?? null;
      return [sub, uni] as const;
    } catch {
      return [address ?? null, null] as const;
    }
  }, [connections, address]);

  // Use ChatContext wallet address as display address
  const displayAddress = walletAddress;
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);

  // Universal account USDC balance via wagmi (Base Sepolia) with automatic refetching
  const { data: universalBalance } = useBalance({
    address: (universalAccountAddr || address || undefined) as any,
    token: USDC_BASE_SEPOLIA as any,
    query: {
      enabled: !!(universalAccountAddr || address),
      refetchInterval: 10000, // Refetch every 10 seconds
      refetchIntervalInBackground: true // Continue refetching when tab is not active
    }
  });

  // Sub account USDC balance via wagmi (Base Sepolia) with automatic refetching
  const { data: subBalance } = useBalance({
    address: (subAccountAddr || address || undefined) as any,
    token: USDC_BASE_SEPOLIA as any,
    query: {
      enabled: !!(subAccountAddr || address),
      refetchInterval: 10000, // Refetch every 10 seconds
      refetchIntervalInBackground: true // Continue refetching when tab is not active
    }
  });

  useEffect(() => {
    // Show disclaimer once per device
    try {
      const seen = localStorage.getItem('tw_seen_disclaimer');
      if (!seen) setShowDisclaimer(true);
    } catch {}
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/polymarket/markets?limit=10');
        const json = await res.json();
        const listRaw: Market[] = Array.isArray(json?.markets)
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
              // parse clobTokenIds for outcome mapping
              const clobRaw = (m as any)?.clobTokenIds;
              let clobIds: string[] = [];
              if (Array.isArray(clobRaw)) clobIds = clobRaw.map((x: any) => String(x));
              else if (typeof clobRaw === 'string') {
                try {
                  const arr = JSON.parse(clobRaw);
                  if (Array.isArray(arr)) clobIds = arr.map((x: any) => String(x));
                } catch {}
              }
              let yesTokenId: string | null = null;
              let noTokenId: string | null = null;
              if (outcomes.length === 2 && prices.length === 2) {
                const iYes = outcomes.findIndex((o) => o?.toLowerCase() === 'yes');
                const iNo = outcomes.findIndex((o) => o?.toLowerCase() === 'no');
                if (iYes > -1) yesPrice = Number(prices[iYes]);
                if (iNo > -1) noPrice = Number(prices[iNo]);
                if (iYes > -1 && clobIds[iYes]) yesTokenId = clobIds[iYes];
                if (iNo > -1 && clobIds[iNo]) noTokenId = clobIds[iNo];
              }
              const end =
                m.endDate ||
                (m as any).end_date ||
                (m as any).endDateIso ||
                (m as any).endsAt ||
                null;
              return {
                id: String(m.id || m.marketId || crypto.randomUUID()),
                title: m.title || m.question,
                image: m.image || m.icon || null,
                icon: m.icon || null,
                endsAt: end,
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
                yesTokenId,
                noTokenId,
                description: typeof m.description === 'string' ? m.description : null
              } as Market;
            })
          : [];
        const list = listRaw.filter((m) => !swipedIds.has(String(m.id)));
        setMarkets(list);
      } catch (e: any) {
        setError(e?.message || 'failed');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [swipedIds]);

  // Update balance display from wagmi balances
  useEffect(() => {
    // Prefer universal balance (main account), fallback to sub balance
    const balanceToUse = universalBalance || subBalance;

    if (!balanceToUse) {
      setUsdcBalance(null);
      return;
    }

    try {
      const raw = balanceToUse.value;
      const decimals = balanceToUse.decimals ?? 6;
      const amount = Number(raw) / 10 ** decimals;
      const formatted = Math.floor(amount).toLocaleString(undefined, { maximumFractionDigits: 0 });
      setUsdcBalance(`${formatted} USDC`);
    } catch {
      setUsdcBalance(null);
    }
  }, [universalBalance, subBalance]);

  // Prefetch when low
  useEffect(() => {
    const prefetch = async () => {
      if (loading || markets.length >= 3) return;
      try {
        const res = await fetch('/api/polymarket/markets?limit=10');
        const json = await res.json();
        const listRaw: Market[] = Array.isArray(json?.markets)
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
              const end =
                m.endDate ||
                (m as any).end_date ||
                (m as any).endDateIso ||
                (m as any).endsAt ||
                null;
              return {
                id: String(m.id || m.marketId || crypto.randomUUID()),
                title: m.title || m.question,
                image: m.image || m.icon || null,
                icon: m.icon || null,
                endsAt: end,
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
        const list = listRaw.filter((m) => !swipedIds.has(String(m.id)));
        setMarkets((prev) => [...prev, ...list]);
      } catch {}
    };
    prefetch();
  }, [markets, loading, swipedIds]);

  const handleSwipe = async (market: Market, side: 'yes' | 'no') => {
    if (showGuides) setShowGuides(false);
    if (cooldown) return;
    setCooldown(true);
    setTimeout(() => setCooldown(false), 1000);
    // Resolve required order params for API: tokenID and price
    const tokenID =
      side === 'yes'
        ? (market as any).yesTokenId || market.id
        : (market as any).noTokenId || market.id;
    const price = side === 'yes' ? market.yesPrice ?? 0.5 : market.noPrice ?? 0.5;
    // Fire-and-forget: do not block UI on transfer/order
    (async () => {
      try {
        const out = await submit(
          { id: String(tokenID), title: market.title },
          side,
          SWIPE_SIZE_USD,
          SLIPPAGE,
          address ?? null
        );
        if (out && out.pending) {
          try {
            const res = await out.pending;
            const ok =
              !!res && ('ok' in (res as any) ? (res as any).ok : (res as any)?.ok !== false);
            if (ok) {
              const idStr = String(market.id);
              const raw = localStorage.getItem('tw_swiped_markets');
              const arr = raw ? (JSON.parse(raw) as any[]) : [];
              if (!arr.includes(idStr)) arr.push(idStr);
              localStorage.setItem('tw_swiped_markets', JSON.stringify(arr));
            }
          } catch {}
        }
      } catch {}
    })();
    try {
      const idStr = String(market.id);
      const raw = localStorage.getItem('tw_swiped_markets');
      const arr = raw ? (JSON.parse(raw) as any[]) : [];
      if (!arr.includes(idStr)) arr.push(idStr);
      localStorage.setItem('tw_swiped_markets', JSON.stringify(arr));
    } catch {}
    setMarkets((prev) => prev.filter((m) => m.id !== market.id));
    // Do not show YES/NO toast here; the hook will show PENDING then final toast
  };

  return (
    <div className="h-full flex flex-col items-center justify-start px-3 sm:px-4 overflow-hidden">
      {/* Wallet header becomes part of main flow */}
      <div className="w-full max-w-sm sm:max-w-md mx-auto mb-3 sm:mb-4 md:mb-16">
        {showDisclaimer && (
          <DisclaimerModal
            onClose={() => {
              setShowDisclaimer(false);
              try {
                localStorage.setItem('tw_seen_disclaimer', '1');
              } catch {}
            }}
          />
        )}
        <WalletHeader
          walletAddress={displayAddress ? shortenAddress(displayAddress) : null}
          onCopy={() => {
            if (!displayAddress) return;
            try {
              navigator.clipboard.writeText(displayAddress);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            } catch {}
          }}
          copied={copied}
          balance={usdcBalance}
          onConnect={async () => {
            try {
              const provider = getBaseAccountProvider();
              await provider.request({ method: 'wallet_connect', params: [] });
              const accounts = await provider.request({
                method: 'eth_requestAccounts',
                params: []
              });

              // If we got accounts, immediately update ChatContext
              if (accounts && Array.isArray(accounts) && accounts.length > 0) {
                const connectedAddress = accounts[0] as string;
                setIsWalletConnected(true);
                setWalletAddress(connectedAddress);

                // Store in localStorage for persistence
                try {
                  localStorage.setItem('tw_address', connectedAddress.toLowerCase());
                } catch {}
              }
            } catch (e) {
              console.error('Connect failed', e);
            }
          }}
          onDisconnect={async () => {
            try {
              disconnect();
            } catch {}
            try {
              await fetch('/api/auth/logout', { method: 'POST' });
            } catch {}
            try {
              localStorage.removeItem('tw_address');
              localStorage.removeItem('tw_verified_addr');
              localStorage.removeItem('tw_verified_until');
            } catch {}
            try {
              const provider = getBaseAccountProvider();
              // Best-effort; some providers implement an explicit disconnect
              await (provider as any).request?.({ method: 'wallet_disconnect', params: [] });
            } catch {}
            // Update ChatContext immediately
            setIsWalletConnected(false);
            setWalletAddress(null);
            setUsdcBalance(null);
          }}
          menuButton={
            <>
              <button
                onClick={() => setIsPositionsOpen(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-[3px] border-black bg-[#34302B] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none sm:h-12 sm:w-12 sm:rounded-xl sm:border-[4px] sm:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:hover:translate-x-[2px] sm:hover:translate-y-[2px] md:h-auto md:w-16 md:rounded-2xl md:border-[5px]"
                aria-label="Menu"
              >
                <Menu className="h-5 w-5 text-white sm:h-6 sm:w-6 md:h-8 md:w-8" strokeWidth={3} />
              </button>
              <PositionsDrawer
                isOpen={isPositionsOpen}
                onClose={() => setIsPositionsOpen(false)}
                userId={address ?? null}
              />
            </>
          }
        />
      </div>
      {loading && <div className="text-sm">Loading…</div>}
      {!loading && error && <div className="text-sm text-red-500">Failed to load markets</div>}
      {!loading && !error && (
        <div className="relative w-full max-w-sm sm:max-w-md h-[70vh] sm:h-[65vh] md:h-[60vh] overflow-visible mx-auto">
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
                    try {
                      const idStr = String(m.id);
                      const raw = localStorage.getItem('tw_swiped_markets');
                      const arr = raw ? (JSON.parse(raw) as any[]) : [];
                      if (!arr.includes(idStr)) arr.push(idStr);
                      localStorage.setItem('tw_swiped_markets', JSON.stringify(arr));
                    } catch {}
                    setMarkets((prev) => prev.filter((x) => x.id !== m.id));
                  }}
                />
              </div>
            );
          })}
          {markets.length === 0 && (
            <div className="text-sm text-muted-foreground">No more markets</div>
          )}

          {/* Swipe Guides (outside the cards) */}
          {showGuides && (
            <div className="pointer-events-none absolute inset-0 z-10">
              {/* Left NO badge */}
              <div className="absolute left-[-6px] md:left-[-10px] top-1/2 -translate-y-1/2 rotate-[-12deg] rounded-xl border-4 border-black bg-pink-400 px-3 py-1.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center gap-1">
                  <X className="h-4 w-4 stroke-[4px] text-black" />
                  <span className="text-xs font-black text-black">NO</span>
                </div>
              </div>
              {/* Right YES badge */}
              <div className="absolute right-[-6px] md:right-[-10px] top-1/2 -translate-y-1/2 rotate-[12deg] rounded-xl border-4 border-black bg-green-400 px-3 py-1.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center gap-1">
                  <Check className="h-4 w-4 stroke-[4px] text-black" />
                  <span className="text-xs font-black text-black">YES</span>
                </div>
              </div>
              {/* Top SKIP badge */}
              <div className="absolute top-[-8px] left-1/2 -translate-x-1/2 rounded-xl border-4 border-black bg-yellow-400 px-3 py-1.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center gap-1">
                  <ArrowUp className="h-4 w-4 stroke-[4px] text-black" />
                  <span className="text-xs font-black text-black">SKIP</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom actions */}
      <div className="mb-2 sm:mt-6 md:mt-12 shrink-0">
        <ActionButtons
          onNo={() => markets[0] && handleSwipe(markets[0], 'no')}
          onSkip={() => {
            if (showGuides) setShowGuides(false);
            const m0 = markets[0];
            if (m0) {
              try {
                const idStr = String(m0.id);
                const raw = localStorage.getItem('tw_swiped_markets');
                const arr = raw ? (JSON.parse(raw) as any[]) : [];
                if (!arr.includes(idStr)) arr.push(idStr);
                localStorage.setItem('tw_swiped_markets', JSON.stringify(arr));
              } catch {}
              setMarkets((prev) => prev.filter((x) => x.id !== m0.id));
            }
            // Skip toast
            const m = markets[0];
            if (m) {
              const toastRoot = document.createElement('div');
              document.body.appendChild(toastRoot);
              const root = createRoot(toastRoot);
              const cleanup = () => {
                try {
                  root.unmount();
                } catch {}
                try {
                  document.body.removeChild(toastRoot);
                } catch {}
              };
              root.render(
                <SwipeToast
                  type={'SKIP'}
                  marketTitle={m.title}
                  onUndo={cleanup}
                  onClose={cleanup}
                />
              );
            }
          }}
          onYes={() => markets[0] && handleSwipe(markets[0], 'yes')}
        />
      </div>
    </div>
  );
}
