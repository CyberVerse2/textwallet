'use client';

import { X, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Position {
  // Position summary from database aggregation
  marketId: string;
  side: string;
  totalSize: number;
  avgPrice: number;
  orderCount: number;
  latestCreatedAt: string;

  // Supporting details from Polymarket
  latestOrderId: string;
  assetId: string;
  outcome: string;
  latestOrderStatus: string;
  latestOrderType: string;
  latestOrderExpiration: string;

  // Market information
  market: {
    id: string;
    title: string;
    url: string;
    outcomes: string[];
    endDate: string;
  };
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
      marketId: 'mock-market-1',
      side: 'yes',
      totalSize: 2.0,
      avgPrice: 0.73,
      orderCount: 1,
      latestCreatedAt: '2024-01-01T00:00:00Z',
      latestOrderId: 'mock-order-1',
      assetId: 'mock-asset-1',
      outcome: 'Yes',
      latestOrderStatus: 'filled',
      latestOrderType: 'FOK',
      latestOrderExpiration: '0',
      market: {
        id: 'mock-market-1',
        title: 'Will Tesla (TSLA) beat quarterly earnings?',
        url: 'https://polymarket.com/event/will-tesla-beat-quarterly-earnings',
        outcomes: ['Yes', 'No'],
        endDate: '2024-12-31'
      }
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
        const list: Position[] = Array.isArray(json?.positions) ? json.positions : [];
        setPositions(list.length ? list : mock);
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
            return list.map((position, index) => {
              const pricePercent = (position.avgPrice * 100).toFixed(1);
              const statusColor =
                position.latestOrderStatus === 'filled'
                  ? 'bg-green-400'
                  : position.latestOrderStatus === 'open'
                  ? 'bg-yellow-400'
                  : 'bg-red-400';

              return (
                <div
                  key={`${position.marketId}-${position.side}` || index}
                  className="mb-3 rounded-xl border-[4px] border-black bg-white p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:p-4"
                >
                  <h3 className="mb-2 line-clamp-2 text-sm font-black leading-tight text-black sm:text-base">
                    {position.market.title}
                  </h3>
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md border-[3px] border-black bg-[#FFD700] px-2 py-1 font-black text-black">
                        {position.outcome} {pricePercent}¢
                      </span>
                      <span
                        className={`rounded-md border-[3px] border-black px-2 py-1 font-black text-black ${statusColor}`}
                      >
                        {position.latestOrderStatus.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-black text-black sm:text-lg">
                        {position.totalSize.toFixed(2)} shares
                      </div>
                      <div className="text-xs font-bold text-black/70">
                        {position.orderCount} order{position.orderCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="mb-2 text-xs text-black/60">
                    <div>Position: {position.side.toUpperCase()}</div>
                    <div>Latest Order: {position.latestOrderId.slice(0, 8)}...</div>
                    <div>Type: {position.latestOrderType}</div>
                    {position.latestOrderExpiration !== '0' && (
                      <div>
                        Expires:{' '}
                        {new Date(
                          Number(position.latestOrderExpiration) * 1000
                        ).toLocaleDateString()}
                      </div>
                    )}
                    <div>Last Trade: {new Date(position.latestCreatedAt).toLocaleDateString()}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 rounded-lg border-[3px] border-black bg-[#D50A0A] py-2 text-xs font-black text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none sm:text-sm">
                      Sell
                    </button>
                    <a
                      href={position.market.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center rounded-lg border-[3px] border-black bg-[#34302B] px-3 py-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
                    >
                      <ExternalLink className="h-4 w-4 text-white" strokeWidth={3} />
                    </a>
                  </div>
                </div>
              );
            });
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
