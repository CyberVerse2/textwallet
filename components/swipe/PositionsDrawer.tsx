'use client';

import { X, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Position {
  market: string;
  avg: string;
  now: string;
  bet: string;
  toWin: string;
  value: string;
  currentPrice: string;
  previousPrice: string;
  change: string;
  changePercent: string;
  polymarketUrl: string;
}

interface PositionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string | null;
}

export function PositionsDrawer({ isOpen, onClose, userId }: PositionsDrawerProps) {
  const [positions, setPositions] = useState<Position[] | null>(null);
  const mock: Position[] = [
    {
      market: 'Will Tesla (TSLA) beat quarterly earnings?',
      avg: 'Yes 73¢',
      now: '1.4 shares',
      bet: '73¢',
      toWin: '73¢',
      value: '$1.00',
      currentPrice: '$1.37',
      previousPrice: '$0.99',
      change: '-$0.01',
      changePercent: '0.68%',
      polymarketUrl: 'https://polymarket.com/event/will-tesla-beat-quarterly-earnings'
    },
    {
      market: 'Will the Tampa Bay Buccaneers win Super Bowl 2026?',
      avg: 'Yes 45¢',
      now: '2.2 shares',
      bet: '$0.99',
      toWin: '$1.21',
      value: '$2.20',
      currentPrice: '$1.00',
      previousPrice: '$0.45',
      change: '+$0.55',
      changePercent: '122.22%',
      polymarketUrl: 'https://polymarket.com/event/will-tampa-bay-buccaneers-win-super-bowl-2026'
    },
    {
      market: 'Will Bitcoin reach $100k by end of 2025?',
      avg: 'Yes 82¢',
      now: '0.8 shares',
      bet: '$0.66',
      toWin: '$0.14',
      value: '$0.80',
      currentPrice: '$1.00',
      previousPrice: '$0.82',
      change: '+$0.18',
      changePercent: '21.95%',
      polymarketUrl: 'https://polymarket.com/event/will-bitcoin-reach-100k-by-end-of-2025'
    },
    {
      market: 'Will Apple announce a foldable iPhone in 2025?',
      avg: 'No 35¢',
      now: '3.0 shares',
      bet: '$1.05',
      toWin: '$1.95',
      value: '$3.00',
      currentPrice: '$1.00',
      previousPrice: '$0.35',
      change: '+$0.65',
      changePercent: '185.71%',
      polymarketUrl: 'https://polymarket.com/event/will-apple-announce-foldable-iphone-2025'
    },
    {
      market: 'Will the S&P 500 close above 6000 this year?',
      avg: 'Yes 68¢',
      now: '1.5 shares',
      bet: '$1.02',
      toWin: '$0.48',
      value: '$1.50',
      currentPrice: '$1.00',
      previousPrice: '$0.68',
      change: '+$0.32',
      changePercent: '47.06%',
      polymarketUrl: 'https://polymarket.com/event/will-sp-500-close-above-6000-this-year'
    }
  ];

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const run = async () => {
      if (!isOpen) return;
      if (!userId) {
        setPositions(mock);
        return;
      }
      try {
        const res = await fetch(`/api/positions?userId=${userId}`, { cache: 'no-store' });
        if (!res.ok) {
          setPositions(mock);
          return;
        }
        const json = await res.json();
        const list: any[] = Array.isArray(json?.positions) ? json.positions : [];
        const mapped: Position[] = list.map((p: any) => ({
          market: p.title || 'Position',
          avg: '—',
          now: `${(p.yesSize ?? 0) + (p.noSize ?? 0)} shares`,
          bet: '—',
          toWin: '—',
          value: `$${((p.yesSize ?? 0) + (p.noSize ?? 0)).toFixed(2)}`,
          currentPrice: '—',
          previousPrice: '—',
          change: '—',
          changePercent: '—',
          polymarketUrl: p.url || '#'
        }));
        setPositions(mapped.length ? mapped : mock);
      } catch {
        setPositions(mock);
      }
    };
    run();
  }, [isOpen, userId]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed right-0 top-0 z-50 h-full w-full overflow-y-auto border-l-[6px] border-black bg-[#FFF8F0] shadow-[-8px_0px_0px_0px_rgba(0,0,0,1)] sm:w-[500px]">
        <div className="sticky top-0 z-10 border-b-[5px] border-black bg-[#D50A0A] p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-white sm:text-2xl">Your Positions</h2>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg border-[3px] border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none sm:h-10 sm:w-10"
              aria-label="Close drawer"
            >
              <X className="h-4 w-4 text-black sm:h-5 sm:w-5" strokeWidth={3} />
            </button>
          </div>
        </div>
        <div className="p-3 sm:p-4">
          {(() => {
            const list = positions ?? mock;
            return list.map((position, index) => (
              <div
                key={index}
                className="mb-3 rounded-xl border-[4px] border-black bg-white p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:p-4"
              >
                <h3 className="mb-2 line-clamp-1 text-sm font-black leading-tight text-black sm:text-base">
                  {position.market}
                </h3>
                <div className="mb-2 flex items-center justify-between gap-2 text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md border-[3px] border-black bg-[#FFD700] px-2 py-1 font-black text-black">
                      {position.avg}
                    </span>
                    <span className="font-bold text-black/70">{position.now}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black text-black sm:text-lg">
                      {position.value}
                    </div>
                    <div
                      className={`text-xs font-bold ${
                        position.change.startsWith('+') ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {position.change} ({position.changePercent})
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 rounded-lg border-[3px] border-black bg-[#D50A0A] py-2 text-xs font-black text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none sm:text-sm">
                    Sell
                  </button>
                  <a
                    href={position.polymarketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center rounded-lg border-[3px] border-black bg-[#34302B] px-3 py-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
                  >
                    <ExternalLink className="h-4 w-4 text-white" strokeWidth={3} />
                  </a>
                </div>
              </div>
            ));
          })()}
          {(() => {
            const list = positions ?? mock;
            return list.length === 0;
          })() && (
            <div className="rounded-2xl border-[5px] border-black bg-white p-8 text-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-lg font-black text-black/50">No positions yet</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
