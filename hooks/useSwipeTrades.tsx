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
    market: { id: string; title: string; tokenID?: string },
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
      console.log('[SwipeTrades] Step 1: Resolving subaccount...');
      let from: string | undefined;
      let universal: string | undefined;
      try {
        const provider = getBaseAccountProvider();
        // Read existing session only – avoid triggering a connect popup here
        console.log('[SwipeTrades] Getting existing accounts...');
        const accounts = (await provider.request({
          method: 'eth_accounts',
          params: []
        })) as string[];
        console.log('[SwipeTrades] Existing accounts:', accounts);
        universal = accounts?.[0];
        // Query subaccounts - always try to get/create a subaccount
        let subAddress: string | undefined;
        if (universal) {
          try {
            console.log('[SwipeTrades] Querying subaccounts for universal:', universal);
            const resp = (await provider.request({
              method: 'wallet_getSubAccounts',
              params: [
                {
                  account: universal,
                  domain: typeof window !== 'undefined' ? window.location.origin : ''
                }
              ]
            })) as { subAccounts?: Array<{ address: string }> };
            console.log('[SwipeTrades] Subaccounts response:', resp);
            subAddress = resp?.subAccounts?.[0]?.address as string | undefined;
            console.log('[SwipeTrades] Resolved subaccount:', subAddress);

            // If no subaccount exists, try to create one
            if (!subAddress) {
              console.log('[SwipeTrades] No subaccount found, attempting to create one...');
              try {
                const createResp = (await provider.request({
                  method: 'wallet_createSubAccount',
                  params: [
                    {
                      account: universal,
                      domain: typeof window !== 'undefined' ? window.location.origin : ''
                    }
                  ]
                })) as { address?: string };
                console.log('[SwipeTrades] Create subaccount response:', createResp);
                subAddress = createResp?.address;
                console.log('[SwipeTrades] Created subaccount:', subAddress);
              } catch (createError) {
                console.error('[SwipeTrades] Error creating subaccount:', createError);
                throw new Error('subaccount_creation_failed');
              }
            }
          } catch (subError) {
            console.error('[SwipeTrades] Error querying subaccounts:', subError);
          }

          // Only use subaccount - no fallbacks
          from = subAddress;

          // Additional validation: check if sub account is properly set up
          if (subAddress && universal) {
            console.log('[SwipeTrades] Sub account setup validation:', {
              universalAccount: universal,
              subAccount: subAddress,
              hasSubAccount: !!subAddress
            });
          }
        }
        console.log('[SwipeTrades] Final from address:', from);
      } catch (accountError) {
        console.error('[SwipeTrades] Error resolving accounts:', accountError);
      }
      if (!from) throw new Error('no_subaccount_available');

      // Log final account decision
      console.log('[SwipeTrades] Account decision:', {
        usingSubAccount: true,
        fromAddress: from
      });

      // 2) Resolve server wallet address
      console.log('[SwipeTrades] Step 2: Resolving server wallet...');
      const statusRes = await fetch('/api/status', { cache: 'no-store' });
      if (!statusRes.ok) throw new Error('status_failed');
      const statusJson = await statusRes.json();
      const serverWallet: string | undefined = statusJson?.serverWallet?.address;
      console.log('[SwipeTrades] Server wallet:', serverWallet);
      if (!serverWallet) throw new Error('missing_server_wallet');

      // 3) Build ERC-20 transfer data for sizeUsd (6 decimals)
      console.log('[SwipeTrades] Step 3: Building transfer data...');
      console.log('[SwipeTrades] Transfer details:', {
        from,
        to: serverWallet,
        amount: sizeUsd,
        token: USDC_BASE_SEPOLIA
      });
      const amountUnits = BigInt(Math.round(sizeUsd * 1_000_000));
      console.log('[SwipeTrades] Amount in units (6 decimals):', amountUnits.toString());
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [serverWallet as `0x${string}`, amountUnits]
      });
      console.log('[SwipeTrades] Encoded transfer data:', data);

      // 4) Send calls via Base Account provider from subaccount
      console.log('[SwipeTrades] Step 4: Sending transfer transaction...');
      const provider = getBaseAccountProvider();

      // Always use subaccount for transfers
      const subAccountAddress = from;
      console.log('[SwipeTrades] Using subaccount for transfer:', subAccountAddress);

      const sendCalls = async () => {
        console.log('[SwipeTrades] Preparing wallet_sendCalls...');
        const callParams = {
          version: '2.0',
          atomicRequired: true,
          from: subAccountAddress, // Specify the sub account address
          calls: [
            {
              to: USDC_BASE_SEPOLIA,
              data,
              value: '0x0'
            }
          ],
          capabilities: {
            // https://docs.cdp.coinbase.com/paymaster/introduction/welcome
            paymasterUrl: 'https://paymaster.cdp.coinbase.com/v1/base-sepolia'
          }
        };
        console.log('[SwipeTrades] Call parameters:', callParams);

        const callsId = await provider.request({
          method: 'wallet_sendCalls',
          params: [callParams]
        });
        console.log('[SwipeTrades] Calls sent:', callsId);
        return callsId;
      };

      try {
        console.log('[SwipeTrades] Attempting first transfer...');
        await sendCalls();
        console.log('[SwipeTrades] Transfer successful!');
      } catch (err: any) {
        console.error('[SwipeTrades] Transfer failed:', err);
        const code = err?.code;
        const msg = String(err?.message || err?.data?.message || '').toLowerCase();
        console.log('[SwipeTrades] Error analysis:', { code, msg });

        // Check for specific Base Account SDK errors
        if (msg.includes('failed to add sub account owner') || msg.includes('unauthorized')) {
          console.error('[SwipeTrades] Sub account setup incomplete - stopping order process');
          throw new Error('sub_account_setup_incomplete');
        }

        if (code === -32602 || msg.includes('replacement underpriced')) {
          console.log('[SwipeTrades] Retrying transfer after 2 second delay...');
          await new Promise((r) => setTimeout(r, 2000));
          try {
            await sendCalls();
            console.log('[SwipeTrades] Retry transfer successful!');
          } catch (retryErr: any) {
            console.error('[SwipeTrades] Retry transfer also failed:', retryErr);
            throw retryErr;
          }
        } else {
          throw err;
        }
      }
    } catch (e) {
      // If transfer fails, stop here and show error toast
      console.error('USDC transfer failed:', e);

      // Show error toast for transfer failure
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

      const errorMessage = String(e).includes('sub_account_setup_incomplete')
        ? 'Sub account setup incomplete'
        : 'Transfer failed';

      r.render(
        // @ts-ignore dynamic props
        React.createElement(SwipeToast as any, {
          type: 'ORDER_FAILED',
          marketTitle: `${errorMessage}: ${market.title}`,
          onClose: close
        })
      );

      return { skipped: true } as const;
    }

    track('trade_submitted', { marketId: market.id, side, sizeUsd, slippage, source: 'swipe' });

    console.log('[SwipeTrades] Step 5: Submitting Polymarket order...');
    console.log('[SwipeTrades] Order payload:', {
      marketId: market.id,
      tokenID: (market as any).tokenID,
      side,
      sizeUsd,
      slippage,
      source: 'swipe',
      userId
    });

    const resPromise = fetch('/api/polymarket/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        marketId: market.id,
        tokenID: (market as any).tokenID,
        side,
        sizeUsd,
        slippage,
        source: 'swipe',
        userId
      }),
      signal
    }).catch((fetchError) => {
      console.error('[SwipeTrades] Order API fetch failed:', fetchError);
      return undefined;
    });

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
        console.log('[SwipeTrades] Step 6: Waiting for order response...');
        const res = await resPromise;
        console.log('[SwipeTrades] Order response received:', res);

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
        console.log('[SwipeTrades] Order success status:', ok);
        const type = ok ? (side.toUpperCase() as 'YES' | 'NO') : 'ORDER';
        const title = ok
          ? `${side.toUpperCase()} • ${market.title}`
          : `Order failed: ${market.title}`;
        console.log('[SwipeTrades] Final toast type:', type, 'title:', title);
        r.render(
          // @ts-ignore dynamic props
          React.createElement(SwipeToast as any, {
            type,
            marketTitle: title,
            onClose: close
          })
        );
      } catch (orderError) {
        console.error('[SwipeTrades] Order promise rejected:', orderError);
        // if pending promise rejected, ensure pending toast closes
        cleanupToast();
      }
    })();

    return { undo: cancel, pending: resPromise } as const;
  };

  return { submit };
}
