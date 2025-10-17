'use client';

import { createBaseAccountSDK } from '@base-org/account';

export async function signInWithBase(): Promise<{ address: string; subAddress?: string } | null> {
  try {
    // Initialize SDK (sub-account creation will be handled via RPC calls below)
    const sdk = createBaseAccountSDK({ appName: 'PolyAgent' });
    const provider = sdk.getProvider();
    // Prefetch a nonce from the server to avoid popup blockers and allow server-side replay protection
    let nonce: string;
    try {
      const nonceRes = await fetch('/api/auth/nonce', { cache: 'no-store' });
      nonce = (await nonceRes.text()).trim();
    } catch {
      // Fallback: generate locally if server prefetch fails
      nonce = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2))
        .replace(/-/g, '')
        .slice(0, 32);
    }

    // 0 — request accounts first per provider requirements
    const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];

    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x2105' }] // Base mainnet 8453
    });

    const connectResponse: any = await provider.request({
      method: 'wallet_connect',
      params: [
        {
          version: '1',
          capabilities: {
            signInWithEthereum: { nonce, chainId: '0x2105' }
          }
        }
      ]
    });
    const connectedAccounts = connectResponse?.accounts || [];
    const { address } = connectedAccounts[0] || {};
    const { message, signature } =
      connectedAccounts[0]?.capabilities?.signInWithEthereum ||
      (connectResponse?.signInWithEthereum as any) ||
      {};

    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, message, signature, nonce })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Signature verification failed: ${text}`);
    }
    // Ensure or fetch a Sub Account for this app origin
    let subAddress: string | undefined;
    try {
      const universal = Array.isArray(accounts) && accounts.length > 0 ? accounts[0] : address;
      const subResp = (await provider.request({
        method: 'wallet_getSubAccounts',
        params: [
          {
            account: universal,
            domain: window.location.origin
          }
        ]
      })) as { subAccounts?: Array<{ address: `0x${string}` }> };
      subAddress = subResp?.subAccounts?.[0]?.address;
      if (!subAddress) {
        const created = (await provider.request({
          method: 'wallet_addSubAccount',
          params: [
            {
              account: { type: 'create' }
            }
          ]
        })) as { address: `0x${string}` };
        subAddress = created?.address;
      }
    } catch {}

    return { address, subAddress };
  } catch (err) {
    console.error('SignInWithBase error:', err);
    return null;
  }
}
