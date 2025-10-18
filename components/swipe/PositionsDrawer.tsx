'use client';

import { X, ExternalLink, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SwipeToast } from './SwipeToast';

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
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [processingPositions, setProcessingPositions] = useState<Set<string>>(new Set());
  const [swipedPositions, setSwipedPositions] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Trigger animation after a brief delay
      setTimeout(() => setIsVisible(true), 10);
    } else {
      document.body.style.overflow = 'unset';
      setIsVisible(false);
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const run = async () => {
      if (!isOpen) return;
      if (!userId) {
        setPositions([]);
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch(`/api/positions?userId=${userId}`, { cache: 'no-store' });
        if (!res.ok) {
          setPositions([]);
          return;
        }
        const json = await res.json();
        const list: Position[] = Array.isArray(json?.positions) ? json.positions : [];
        setPositions(list);
      } catch {
        setPositions([]);
      } finally {
        setIsLoading(false);
      }
    };
    run();
  }, [isOpen, userId]);

  const handleSellPosition = async (position: Position) => {
    if (!userId) {
      return;
    }

    const positionKey = `${position.marketId}-${position.side}`;

    // Add to processing set
    setProcessingPositions((prev) => new Set(prev).add(positionKey));

    // Immediately swipe the card (remove from view)
    setSwipedPositions((prev) => new Set(prev).add(positionKey));

    // Create toast
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

    const undo = () => {
      // Remove from swiped set to bring back the card
      setSwipedPositions((prev) => {
        const newSet = new Set(prev);
        newSet.delete(positionKey);
        return newSet;
      });
      cleanup();
    };

    // Show PENDING toast immediately
    root.render(
      <SwipeToast
        type="PENDING"
        marketTitle={`Selling ${position.side.toUpperCase()} position: ${position.market.title}`}
        onClose={cleanup}
      />
    );

    // Process sell in background
    try {
      const res = await fetch('/api/polymarket/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          marketId: position.marketId,
          side: position.side,
          size: position.totalSize,
          source: 'positions-drawer'
        })
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Sell failed');
      }

      // Update toast to success
      root.render(
        <SwipeToast
          type="ORDER"
          marketTitle={`Sold ${position.side.toUpperCase()} position: ${position.market.title}`}
          onClose={cleanup}
        />
      );

      // Auto-close after 3 seconds
      setTimeout(cleanup, 3000);

      // Refresh positions after successful sell
      const refreshRes = await fetch(`/api/positions?userId=${userId}`, { cache: 'no-store' });
      if (refreshRes.ok) {
        const refreshJson = await refreshRes.json();
        const list: Position[] = Array.isArray(refreshJson?.positions) ? refreshJson.positions : [];
        setPositions(list);
      }
    } catch (error: any) {
      console.error('Sell error:', error);

      // Update toast to show error
      root.render(
        <SwipeToast
          type="ORDER"
          marketTitle={`Failed to sell: ${error.message}`}
          onClose={cleanup}
        />
      );

      // Auto-close after 5 seconds
      setTimeout(cleanup, 5000);

      // Bring back the card on error
      setSwipedPositions((prev) => {
        const newSet = new Set(prev);
        newSet.delete(positionKey);
        return newSet;
      });
    } finally {
      // Remove from processing set
      setProcessingPositions((prev) => {
        const newSet = new Set(prev);
        newSet.delete(positionKey);
        return newSet;
      });
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`fixed right-0 top-0 z-50 h-full w-full overflow-y-auto border-l-[6px] border-black bg-[#FFF8F0] shadow-[-8px_0px_0px_0px_rgba(0,0,0,1)] sm:w-[500px] transform transition-transform duration-300 ease-out ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
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
          {isLoading ? (
            <div className="rounded-2xl border-[5px] border-black bg-white p-8 text-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-lg font-black text-black/50">Loading positions...</p>
            </div>
          ) : (
            <>
              {(() => {
                const list = positions ?? [];
                const filteredList = list.filter((position) => {
                  const positionKey = `${position.marketId}-${position.side}`;
                  return !swipedPositions.has(positionKey);
                });
                return filteredList.map((position, index) => {
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
                        <div>
                          Last Trade: {new Date(position.latestCreatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSellPosition(position)}
                          className="flex-1 rounded-lg border-[3px] border-black bg-[#D50A0A] py-2 text-xs font-black text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none sm:text-sm hover:bg-[#B80808]"
                        >
                          Sell
                        </button>
                        <a
                          href={`https://polymarket.com/event/${position.marketId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center rounded-lg border-[3px] border-black bg-[#34302B] px-3 py-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
                          title="View on Polymarket"
                        >
                          <ExternalLink className="h-4 w-4 text-white" strokeWidth={3} />
                        </a>
                      </div>
                    </div>
                  );
                });
              })()}
              {(() => {
                const list = positions ?? [];
                const filteredList = list.filter((position) => {
                  const positionKey = `${position.marketId}-${position.side}`;
                  return !swipedPositions.has(positionKey);
                });
                return filteredList.length === 0;
              })() && (
                <div className="rounded-2xl border-[5px] border-black bg-white p-8 text-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                  <p className="text-lg font-black text-black/50">No positions yet</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
