'use client';

import React, { useRef } from 'react';
import { track } from '@/lib/analytics';

export type SwipeSide = 'yes' | 'no';

export function useSwipeTrades() {
  const cooldownRef = useRef(false);
  const UNDO_MS = 2000;

  const submit = async (
    market: { id: string; title: string },
    side: SwipeSide,
    sizeUsd = 2,
    slippage = 0.01,
    userId?: string | null
  ) => {
    if (cooldownRef.current) return { skipped: true } as const;
    cooldownRef.current = true;
    setTimeout(() => (cooldownRef.current = false), 1000);

    const controller = new AbortController();
    const signal = controller.signal;

    track('trade_submitted', { marketId: market.id, side, sizeUsd, slippage, source: 'swipe' });

    const resPromise = fetch('/api/polymarket/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        marketId: market.id,
        side,
        sizeUsd,
        slippage,
        source: 'swipe',
        userId
      }),
      signal
    }).catch(() => undefined);

    const undoTimer = setTimeout(() => {}, UNDO_MS);

    const cancel = () => {
      clearTimeout(undoTimer);
      try {
        controller.abort();
      } catch {}
      track('undo_click', { marketId: market.id, side });
    };

    return { undo: cancel, pending: resPromise } as const;
  };

  return { submit };
}
