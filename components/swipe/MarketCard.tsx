'use client';

import React, { useRef, useState } from 'react';

export default function MarketCard({
  market,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp
}: {
  market: { id: string; title: string; subtitle?: string; icon?: string };
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
      className="h-full w-full bg-white rounded-2xl border-2 border-black p-6 flex flex-col justify-center"
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
      <div className="text-xl font-bold mb-2">{market.title}</div>
      {market.subtitle && (
        <div className="text-sm text-muted-foreground mb-4">{market.subtitle}</div>
      )}
      <div className="text-xs text-muted-foreground">Drag left for NO, right for YES</div>
    </div>
  );
}
