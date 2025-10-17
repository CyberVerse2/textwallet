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

    // Render a persistent PENDING toast at bottom while USDC transfer and order proceed
    const toastRoot = document.createElement('div');
    document.body.appendChild(toastRoot);
    const { createRoot } = await import('react-dom/client');
    const { SwipeToast } = await import('@/components/swipe/SwipeToast');
    const root = createRoot(toastRoot);
    const cleanupToast = () => {
      try {
        root.unmount();
      } catch {}
      try {
        document.body.removeChild(toastRoot);
      } catch {}
    };
    root.render(
      // Pending stays until explicitly closed/updated
      // @ts-ignore component type is dynamic
      React.createElement(SwipeToast as any, {
        type: 'PENDING',
        marketTitle: `${side.toUpperCase()} • ${market.title}`,
        onClose: cleanupToast
      })
    );

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

      const sendCalls = async () =>
        provider.request({
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

      try {
        await sendCalls();
      } catch (err: any) {
        const code = err?.code;
        const msg = String(err?.message || err?.data?.message || '').toLowerCase();
        if (code === -32602 || msg.includes('replacement underpriced')) {
          await new Promise((r) => setTimeout(r, 2000));
          await sendCalls();
        } else {
          throw err;
        }
      }
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
      cleanupToast();
    };

    // When order promise resolves, replace PENDING with final YES/NO toast, or ORDER on failure
    (async () => {
      try {
        const res = await resPromise;
        // success or failure, we replace pending with final toast
        cleanupToast();
        const mount = document.createElement('div');
        document.body.appendChild(mount);
        const { createRoot } = await import('react-dom/client');
        const { SwipeToast } = await import('@/components/swipe/SwipeToast');
        const r = createRoot(mount);
        const close = () => {
          try {
            r.unmount();
          } catch {}
          try {
            document.body.removeChild(mount);
          } catch {}
        };
        const ok = !!res && 'ok' in (res as any) ? (res as any).ok : (res as any)?.ok !== false;
        const type = ok ? (side.toUpperCase() as 'YES' | 'NO') : 'ORDER';
        const title = ok
          ? `${side.toUpperCase()} • ${market.title}`
          : `Order failed: ${market.title}`;
        r.render(
          // @ts-ignore dynamic props
          React.createElement(SwipeToast as any, {
            type,
            marketTitle: title,
            onClose: close
          })
        );
      } catch {
        // if pending promise rejected, ensure pending toast closes
        cleanupToast();
      }
    })();

    return { undo: cancel, pending: resPromise } as const;
  };

  return { submit };
}
