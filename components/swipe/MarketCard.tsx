'use client';

import React, { useRef, useState } from 'react';

export default function MarketCard({
  market,
  onSwipeLeft,
  onSwipeRight
}: {
  market: { id: string; title: string; subtitle?: string; icon?: string };
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  const startX = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current == null) return;
    setOffset(e.clientX - startX.current);
  };
  const onPointerUp = () => {
    if (Math.abs(offset) > 120) {
      offset > 0 ? onSwipeRight() : onSwipeLeft();
    }
    startX.current = null;
    setOffset(0);
  };

  return (
    <div
      className="h-full w-full bg-white rounded-2xl border-2 border-black p-6 flex flex-col justify-center"
      style={{
        boxShadow: '8px 8px 0px 0px #000000',
        transform: `translateX(${offset}px) rotate(${offset / 40}deg)`,
        transition: startX.current == null ? 'transform 150ms ease' : undefined
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="text-xl font-bold mb-2">{market.title}</div>
      {market.subtitle && (
        <div className="text-sm text-muted-foreground mb-4">{market.subtitle}</div>
      )}
      <div className="text-xs text-muted-foreground">Drag left for NO, right for YES</div>
    </div>
  );
}
