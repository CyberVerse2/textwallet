'use client';

import { useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export type SwipeSide = 'yes' | 'no';

export function useSwipeTrades() {
  const cooldownRef = useRef(false);
  const { toast, dismiss } = useToast();
  const UNDO_MS = 2000;

  const submit = async (
    market: { id: string; title: string },
    side: SwipeSide,
    sizeUsd = 2,
    slippage = 0.01
  ) => {
    if (cooldownRef.current) return { skipped: true } as const;
    cooldownRef.current = true;
    setTimeout(() => (cooldownRef.current = false), 1000);

    const t = toast({
      title: `${side.toUpperCase()} $${sizeUsd}`,
      description: market.title
    });

    // Fire-and-forget trade
    const controller = new AbortController();
    const signal = controller.signal;

    const resPromise = fetch('/api/polymarket/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketId: market.id, side, sizeUsd, slippage, source: 'swipe' }),
      signal
    }).catch(() => undefined);

    // Allow undo within UNDO_MS (best-effort; placeholder cancel)
    const undoTimer = setTimeout(() => {
      // let trade complete; close toast
      t.dismiss();
    }, UNDO_MS);

    const undo = () => {
      clearTimeout(undoTimer);
      try {
        controller.abort();
      } catch {}
      t.update({ title: 'Undone', description: market.title });
      setTimeout(() => t.dismiss(), 700);
    };

    return { undo, pending: resPromise } as const;
  };

  return { submit };
}
