import { createBaseAccountSDK } from '@base-org/account';
import { base } from 'viem/chains';
import supabaseAdmin from '@/lib/supabaseAdmin';

export interface SpendPermissionInput {
  account: `0x${string}`;
  spender: `0x${string}`;
  token: `0x${string}`;
  allowance: bigint;
  periodInDays: number;
  startUnix?: number;
  endUnix?: number;
}

export async function requestAndStoreSpendPermission(userId: string, input: SpendPermissionInput) {
  const sdk = createBaseAccountSDK({ appName: 'PolyAgent', appChainIds: [base.id] });
  const { requestSpendPermission } = await import('@base-org/account/spend-permission');
  const permission = await requestSpendPermission({
    account: input.account,
    spender: input.spender,
    token: input.token,
    chainId: base.id,
    allowance: input.allowance,
    periodInDays: input.periodInDays,
    provider: sdk.getProvider()
  } as any);
  const { fetchPermission } = await import('@base-org/account/spend-permission');
  // permission.hash is the canonical id
  const permissionHash: string =
    (permission as any).hash ||
    (await fetchPermission({
      permissionHash: (permission as any).hash,
      provider: sdk.getProvider()
    }),
    (permission as any).hash);
  await supabaseAdmin.from('spend_permissions').upsert({
    permission_hash: permissionHash,
    user_id: userId.toLowerCase(),
    token_address: input.token,
    allowance: Number(input.allowance.toString()),
    period_seconds: input.periodInDays * 86400,
    start_unix: input.startUnix ?? Math.floor(Date.now() / 1000),
    end_unix: input.endUnix ?? Math.floor(Date.now() / 1000) + input.periodInDays * 86400,
    permission_json: permission
  });
  return { permissionHash };
}
