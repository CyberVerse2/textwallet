'use client';

import React, { useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { track } from '@/lib/analytics';

export type SwipeSide = 'yes' | 'no';

export function useSwipeTrades() {
  const cooldownRef = useRef(false);
  const { toast } = useToast();
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

    let undoCalled = false;
    const controller = new AbortController();
    const signal = controller.signal;

    const undo = () => {
      if (undoCalled) return;
      undoCalled = true;
      try {
        controller.abort();
      } catch {}
      toastApi.update({ title: 'Undone', description: market.title });
      setTimeout(() => toastApi.dismiss(), 700);
    };

    const toastApi = toast({
      title: `${side.toUpperCase()} $${sizeUsd}`,
      description: market.title,
      action: (
        <ToastAction altText="Undo" onClick={undo}>
          Undo
        </ToastAction>
      )
    });

    track('trade_submitted', { marketId: market.id, side, sizeUsd, slippage, source: 'swipe' });

    const resPromise = fetch('/api/polymarket/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketId: market.id, side, sizeUsd, slippage, source: 'swipe' }),
      signal
    }).catch(() => undefined);

    const undoTimer = setTimeout(() => {
      toastApi.dismiss();
    }, UNDO_MS);

    const cancel = () => {
      clearTimeout(undoTimer);
      undo();
      track('undo_click', { marketId: market.id, side });
    };

    return { undo: cancel, pending: resPromise } as const;
  };

  return { submit };
}
