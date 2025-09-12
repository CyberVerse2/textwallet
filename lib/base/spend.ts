import { CdpClient } from '@coinbase/cdp-sdk';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { getServerWalletAddress } from '@/lib/cdp';

export interface SpendResult {
  ok: boolean;
  approveTx?: string;
  spendTx?: string;
  error?: string;
}

export async function spendFromPermission(
  userId: string,
  amountUnits: bigint
): Promise<SpendResult> {
  try {
    const usdc = (await import('@/lib/cdp')).getUsdcAddress('base');
    const userIdLower = userId.toLowerCase();
    const { data: perm, error } = await supabaseAdmin
      .from('spend_permissions')
      .select('permission_json, permission_hash')
      .eq('user_id', userIdLower)
      .eq('token_address', usdc)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      try {
        console.error('🔎 spendFromPermission query error', {
          userId: userIdLower,
          error: error.message
        });
      } catch {}
      return { ok: false, error: error.message };
    }
    if (!perm?.permission_json) {
      try {
        console.warn('🔎 spendFromPermission no_permission', { userId: userIdLower });
      } catch {}
      return { ok: false, error: 'no_permission' };
    }

    const permission = perm.permission_json as any;
    // Runtime fallback: inject chainId if absent (Base mainnet 8453)
    const ensuredPermission: any = { ...(permission || {}) };
    if (!ensuredPermission.chainId) {
      try {
        console.warn('⚠️ spendFromPermission missing chainId, injecting 8453', {
          userId: userIdLower,
          permissionHash: (perm as any).permission_hash
        });
      } catch {}
      ensuredPermission.chainId = 8453;
    }
    if (ensuredPermission.permission && !ensuredPermission.permission.chainId) {
      ensuredPermission.permission.chainId = 8453;
    }

    const { prepareSpendCallData } = await import('@base-org/account/spend-permission');
    const calls: any[] = await prepareSpendCallData({
      permission: ensuredPermission,
      amount: amountUnits
    } as any);

    const cdp = new (await import('@coinbase/cdp-sdk')).CdpClient();
    const spender = await (await import('@/lib/cdp')).getServerWalletAddress();

    let approveTx: string | undefined;
    let spendTx: string | undefined;
    for (const call of calls) {
      const txHash = await cdp.evm.sendTransaction({
        address: spender,
        transaction: {
          to: call.to,
          data: call.data,
          value: call.value ?? '0x0'
        },
        network: 'base'
      });
      if (!approveTx) approveTx = txHash as any;
      else spendTx = txHash as any;
    }
    return { ok: true, approveTx, spendTx };
  } catch (e: any) {
    try {
      console.error('❌ spendFromPermission unexpected', {
        userId: userId.toLowerCase(),
        message: e?.message
      });
    } catch {}
    return { ok: false, error: e?.message || String(e) };
  }
}
