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

    async function retryPrepare(permissionArg: any, amountArg: bigint) {
      let lastErr: any;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await prepareSpendCallData(permissionArg, amountArg);
        } catch (e: any) {
          lastErr = e;
          const msg = String(e?.message || e);
          const isRateLimited = msg.includes('429') || msg.includes('over rate limit');
          if (!isRateLimited) break;
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
      }
      throw lastErr;
    }

    const calls: any[] = await retryPrepare(ensuredPermission as any, amountUnits);

    const cdp = new CdpClient();
    const spender = await getServerWalletAddress();
    const maybePaymaster = process.env.CDP_PAYMASTER_URL
      ? { paymasterService: { url: process.env.CDP_PAYMASTER_URL as string } }
      : undefined;

    // Preflight gas check: if no paymaster, ensure spender has ETH on Base
    if (!maybePaymaster) {
      try {
        const { getPublicClient } = await import('@/lib/cdp');
        const client: any = getPublicClient('base');
        const ethBal: bigint = await client.getBalance({ address: spender as any });
        if (ethBal === 0n) {
          console.warn('⛽ spender has zero ETH and no paymaster configured', { spender });
          return { ok: false, error: 'spender_insufficient_gas' };
        }
      } catch (e: any) {
        console.warn('⚠️ gas preflight failed, proceeding', { message: e?.message });
      }
    }

    let approveTx: string | undefined;
    let spendTx: string | undefined;
    try {
      const normalizedCalls = calls.map((c: any) => {
        const obj: any = { to: c.to, data: c.data };
        if (c.value && c.value !== '0x0' && c.value !== '0') obj.value = c.value;
        return obj;
      });
      const evmAny: any = cdp.evm as any;
      if (typeof evmAny.sendCalls === 'function') {
        try {
          console.log('🧾 CDP sendCalls', {
            count: normalizedCalls.length,
            hasPaymaster: Boolean(maybePaymaster)
          });
        } catch {}
        const result = await evmAny.sendCalls({
          address: spender,
          calls: normalizedCalls,
          network: 'base',
          capabilities: maybePaymaster
        });
        // Best effort: result may contain array or single hash; assign in order
        const hashes: string[] = Array.isArray(result) ? result : [result];
        approveTx = hashes[0] as any;
        spendTx = hashes[1] as any;
        return { ok: true, approveTx, spendTx };
      }
    } catch (e) {
      try {
        console.warn('⚠️ CDP sendCalls unavailable/fallback', { message: (e as any)?.message });
      } catch {}
    }

    // Fallback: send sequential transactions with fee params
    for (const call of calls) {
      const tx: any = { to: call.to, data: call.data };
      if (call.value && call.value !== '0x0' && call.value !== '0') tx.value = call.value;
      try {
        const { getPublicClient } = await import('@/lib/cdp');
        const client: any = getPublicClient('base');
        const fees: any = await client
          .estimateFeesPerGas()
          .catch(async () => ({ gasPrice: await client.getGasPrice() }));
        if (fees?.maxFeePerGas && fees?.maxPriorityFeePerGas) {
          tx.maxFeePerGas = fees.maxFeePerGas;
          tx.maxPriorityFeePerGas = fees.maxPriorityFeePerGas;
        } else if (fees?.gasPrice) {
          tx.gasPrice = fees.gasPrice;
        }
      } catch {}

      try {
        console.log('🧾 CDP sendTransaction', {
          to: String(tx.to),
          hasData: Boolean(tx.data && String(tx.data).startsWith('0x')),
          hasValue: tx.value != null,
          hasFee: tx.maxFeePerGas != null || tx.gasPrice != null
        });
      } catch {}

      // Retry send to mitigate transient rate limits from RPC
      let sentHash: string | undefined;
      let lastErr: any;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const txHash = await cdp.evm.sendTransaction({
            address: spender,
            transaction: tx,
            network: 'base'
          });
          sentHash = txHash as any;
          break;
        } catch (e: any) {
          lastErr = e;
          const msg = String(e?.message || e);
          const isRateLimited = msg.includes('429') || msg.includes('over rate limit');
          if (!isRateLimited) break;
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
      }
      if (!sentHash) throw lastErr;

      if (!approveTx) approveTx = sentHash;
      else spendTx = sentHash;
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
