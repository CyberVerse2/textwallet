'use client';

import { createBaseAccountSDK } from '@base-org/account';
import { baseSepolia } from 'viem/chains';

type BaseAccountSDK = ReturnType<typeof createBaseAccountSDK>;
type BaseAccountProvider = ReturnType<BaseAccountSDK['getProvider']>;

let sdkInstance: BaseAccountSDK | null = null;
let providerInstance: BaseAccountProvider | null = null;

function maskAddress(addr?: string | null): string {
  if (!addr) return '';
  const a = addr.toString();
  if (a.length < 10) return a;
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

export function getBaseAccountProvider(): BaseAccountProvider {
  if (!sdkInstance) {
    console.debug('[BaseAccountSDK] Initializing SDK (singleton)');
    sdkInstance = createBaseAccountSDK({
      appName: 'TextWallet',
      appLogoUrl: 'https://base.org/logo.png',
      appChainIds: [baseSepolia.id],
      subAccounts: {
        creation: 'on-connect',
        defaultAccount: 'sub'
      } as any
    });
  }
  if (!providerInstance) {
    console.debug('[BaseAccountSDK] Creating provider instance');
    providerInstance = sdkInstance.getProvider();
  }
  return providerInstance;
}

export async function getSDKAccounts(): Promise<string[]> {
  const provider = getBaseAccountProvider();
  // Ensure the wallet connect flow has been run
  try {
    console.debug('[BaseAccountSDK] Request: wallet_connect');
    await provider.request({ method: 'wallet_connect', params: [] });
  } catch (e) {
    console.warn('[BaseAccountSDK] wallet_connect failed or was already connected', e);
  }
  const accounts = (await provider.request({
    method: 'eth_requestAccounts',
    params: []
  })) as string[];
  console.debug(
    '[BaseAccountSDK] Accounts received:',
    Array.isArray(accounts) ? accounts.map((a) => maskAddress(a)) : accounts
  );
  return accounts || [];
}

export async function verifySubAccountCreated(): Promise<{
  verified: boolean;
  subAccount?: string;
  universalAccount?: string;
  reason?: string;
}> {
  try {
    console.debug('[BaseAccountSDK] Verifying sub account creation…');
    const accounts = await getSDKAccounts();
    if (!accounts || accounts.length < 2) {
      console.warn('[BaseAccountSDK] Verification failed: less_than_two_accounts', accounts);
      return { verified: false, reason: 'less_than_two_accounts' };
    }
    const [subAccount, universalAccount] = accounts;
    if (!subAccount || !universalAccount) {
      console.warn('[BaseAccountSDK] Verification failed: missing_addresses', accounts);
      return { verified: false, reason: 'missing_addresses' };
    }
    if (subAccount.toLowerCase() === universalAccount.toLowerCase()) {
      console.warn('[BaseAccountSDK] Verification failed: addresses_equal', {
        sub: maskAddress(subAccount),
        universal: maskAddress(universalAccount)
      });
      return { verified: false, reason: 'addresses_equal' };
    }
    console.debug('[BaseAccountSDK] Verification success', {
      sub: maskAddress(subAccount),
      universal: maskAddress(universalAccount)
    });
    return { verified: true, subAccount, universalAccount };
  } catch (e: any) {
    console.error('[BaseAccountSDK] Verification error', e);
    return { verified: false, reason: e?.message || 'unknown_error' };
  }
}
