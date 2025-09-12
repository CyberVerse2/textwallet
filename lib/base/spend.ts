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
    const { data: perm, error } = await supabaseAdmin
      .from('spend_permissions')
      .select('permission_json')
      .eq('user_id', userId.toLowerCase())
      .order('created_at', { ascending: false })
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!perm?.permission_json) return { ok: false, error: 'no_permission' };

    const permission = perm.permission_json as any;
    const { prepareSpendCallData } = await import('@base-org/account/spend-permission');
    const calls: any[] = await prepareSpendCallData({ permission, amount: amountUnits } as any);

    const cdp = new CdpClient();
    const spender = await getServerWalletAddress();

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
    return { ok: false, error: e?.message || String(e) };
  }
}
