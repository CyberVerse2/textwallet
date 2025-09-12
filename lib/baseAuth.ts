'use client';

import { createBaseAccountSDK } from '@base-org/account';

export async function signInWithBase(): Promise<{ address: string } | null> {
  try {
    // Provide required app metadata to the SDK (prevents undefined appName error)
    const provider = createBaseAccountSDK({ appName: 'PolyAgent' }).getProvider();
    const nonce = (
      globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)
    ).replace(/-/g, '');

    // 0 — request accounts first per provider requirements
    await provider.request({ method: 'eth_requestAccounts' });

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
    const accounts = connectResponse?.accounts || [];
    const { address } = accounts[0] || {};
    const { message, signature } =
      accounts[0]?.capabilities?.signInWithEthereum ||
      (connectResponse?.signInWithEthereum as any) ||
      {};

    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, message, signature })
    });
    if (!res.ok) throw new Error('Signature verification failed');
    return { address };
  } catch (err) {
    console.error('SignInWithBase error:', err);
    return null;
  }
}
