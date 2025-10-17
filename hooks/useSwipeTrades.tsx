'use client';

import React, { useRef } from 'react';
import { track } from '@/lib/analytics';
import { getBaseAccountProvider } from '@/lib/baseAccountSdk';
import { encodeFunctionData, erc20Abi } from 'viem';
import { baseSepolia } from 'viem/chains';

export type SwipeSide = 'yes' | 'no';

const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;

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

    try {
      // 1) Resolve subaccount using Base Account SDK flow (ensure sub exists)
      let from: string | undefined;
      let universal: string | undefined;
      try {
        const provider = getBaseAccountProvider();
        // Read existing session only – avoid triggering a connect popup here
        const accounts = (await provider.request({
          method: 'eth_accounts',
          params: []
        })) as string[];
        universal = accounts?.[0];
        // Query subaccounts
        let subAddress: string | undefined;
        if (universal) {
          try {
            const resp = (await provider.request({
              method: 'wallet_getSubAccounts',
              params: [
                {
                  account: universal,
                  domain: typeof window !== 'undefined' ? window.location.origin : ''
                }
              ]
            })) as { subAccounts?: Array<{ address: string }> };
            subAddress = resp?.subAccounts?.[0]?.address as string | undefined;
          } catch {}
          from = subAddress || universal;
        }
      } catch {}
      if (!from) throw new Error('not_connected');
      // 2) Resolve server wallet address
      const statusRes = await fetch('/api/status', { cache: 'no-store' });
      if (!statusRes.ok) throw new Error('status_failed');
      const statusJson = await statusRes.json();
      const serverWallet: string | undefined = statusJson?.serverWallet?.address;
      if (!serverWallet) throw new Error('missing_server_wallet');

      // 3) Build ERC-20 transfer data for sizeUsd (6 decimals)
      const amountUnits = BigInt(Math.round(sizeUsd * 1_000_000));
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [serverWallet as `0x${string}`, amountUnits]
      });

      // 4) Send calls via Base Account provider from subaccount
      const provider = getBaseAccountProvider();

      await provider.request({
        method: 'wallet_sendCalls',
        params: [
          {
            version: '2.0',
            atomicRequired: true,
            chainId: `0x${baseSepolia.id.toString(16)}`,
            from,
            calls: [
              {
                to: USDC_BASE_SEPOLIA,
                data,
                value: '0x0'
              }
            ]
          }
        ]
      });
    } catch (e) {
      // If transfer fails, stop here
      console.error('USDC transfer failed:', e);
      return { skipped: true } as const;
    }

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
