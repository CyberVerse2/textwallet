'use client';

import React, { useRef, useState } from 'react';

export default function MarketCard({
  market,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp
}: {
  market: {
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
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp?: () => void;
}) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [yOffset, setYOffset] = useState(0);
  const lastDx = useRef(0);
  const lastDy = useRef(0);
  const [animateUp, setAnimateUp] = useState(false);

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    startY.current = e.clientY;
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current == null || startY.current == null) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    lastDx.current = dx;
    lastDy.current = dy;
    setOffset(dx);
    setYOffset(dy);
  };
  const onPointerUp = () => {
    const dx = lastDx.current;
    const dy = lastDy.current;
    const threshold = 120;
    if (Math.abs(dy) > threshold && Math.abs(dy) > Math.abs(dx)) {
      setAnimateUp(true);
      setTimeout(() => {
        onSwipeUp && onSwipeUp();
        setAnimateUp(false);
        setYOffset(0);
      }, 200);
    } else if (Math.abs(dx) > threshold) {
      dx > 0 ? onSwipeRight() : onSwipeLeft();
    }
    startX.current = null;
    startY.current = null;
    setOffset(0);
  };

  return (
    <div
      className="h-full w-full bg-white rounded-2xl border-2 border-black p-5 md:p-6 flex flex-col gap-3 justify-between"
      style={{
        boxShadow: '8px 8px 0px 0px #000000',
        transform: animateUp
          ? 'translateY(-120%)'
          : `translateX(${offset}px) translateY(${yOffset}px) rotate(${offset / 40}deg)`,
        transition: startX.current == null ? 'transform 180ms ease' : undefined,
        opacity: animateUp ? 0.8 : 1
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Header */}
      <div>
        {market.image && (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={market.image}
              alt=""
              className="w-full h-32 object-cover rounded-lg border-2 border-black"
            />
            <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col gap-2">
        <div className="text-lg font-bold leading-snug">{market.title}</div>
        {market.description && (
          <div className="text-xs text-muted-foreground line-clamp-3">{market.description}</div>
        )}
        <div className="grid grid-cols-2 gap-3 mt-1">
          <div
            className="p-3 rounded-lg border-2 border-black"
            style={{ boxShadow: '2px 2px 0px 0px #000000' }}
          >
            <div className="text-xs font-semibold mb-1">Yes potential</div>
            <div className="text-sm font-bold">
              {typeof market.yesPrice === 'number'
                ? `$${(2 / Math.max(0.01, market.yesPrice)).toFixed(2)}`
                : '—'}
            </div>
            {typeof market.yesPrice === 'number' && (
              <div className="text-[11px] text-muted-foreground">
                Price: {(market.yesPrice * 100).toFixed(1)}¢
              </div>
            )}
          </div>
          <div
            className="p-3 rounded-lg border-2 border-black"
            style={{ boxShadow: '2px 2px 0px 0px #000000' }}
          >
            <div className="text-xs font-semibold mb-1">No potential</div>
            <div className="text-sm font-bold">
              {typeof market.noPrice === 'number'
                ? `$${(2 / Math.max(0.01, market.noPrice)).toFixed(2)}`
                : '—'}
            </div>
            {typeof market.noPrice === 'number' && (
              <div className="text-[11px] text-muted-foreground">
                Price: {(market.noPrice * 100).toFixed(1)}¢
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-2">
        <div className="text-[11px] text-muted-foreground mb-2">
          Drag left for NO, right for YES. Swipe up to skip.
        </div>
        <div className="text-xs text-muted-foreground flex items-center justify-between">
          {market.endsAt ? (
            <span>Ends: {new Date(market.endsAt).toLocaleDateString()}</span>
          ) : (
            <span />
          )}
          {typeof market.volume === 'number' ? (
            <span className="font-semibold">Vol: ${formatAbbrev(market.volume)}</span>
          ) : (
            <span />
          )}
        </div>
      </div>
    </div>
  );
}

function formatAbbrev(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}b`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${Math.round(n)}`;
}
