import { ClobClient, Side, OrderType, type ApiKeyCreds } from '@polymarket/clob-client';
import { Wallet } from '@ethersproject/wallet';

export interface PostOrderParams {
  tokenID: string;
  price: number; // 0-1
  side: 'buy' | 'sell' | 'YES' | 'NO' | 'yes' | 'no';
  size: number; // in tokens (USDC notionals depend on price)
  feeRateBps?: number; // default 0
  tickSize: number; // e.g. 0.001
  negRisk: boolean; // true for neg risk markets
  timeInForce?: OrderType; // default GTC
}

export interface PostOrderResult {
  ok: boolean;
  order?: any;
  error?: string;
}

export function getPolymarketHost(): string {
  return process.env.POLYMARKET_HOST || 'https://clob.polymarket.com';
}

export async function getPolymarketClient() {
  const host = getPolymarketHost();
  const chainId = 137; // Polygon mainnet
  const privateKey = process.env.POLYMARKET_TRADER_PRIVATE_KEY;
  if (!privateKey) throw new Error('Missing POLYMARKET_TRADER_PRIVATE_KEY');
  const signer = new Wallet(privateKey);
  let creds: ApiKeyCreds;
  try {
    // Prefer derive or createOrDerive as per Polymarket guidance
    creds = await new ClobClient(host, chainId, signer).createOrDeriveApiKey();
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error('🧩 Polymarket API key error', { signer: signer.address, message: msg });
    throw new Error('polymarket_api_key_failed');
  }
  // Signature type: 0 = EOA (browser wallets), 1 = Magic/email login
  const signatureType = (() => {
    const raw = process.env.POLYMARKET_SIGNATURE_TYPE;
    const parsed = raw != null ? Number(raw) : 0;
    return parsed === 1 ? 1 : 0;
  })();
  // Use configured funder if provided; otherwise default to signer
  const funder = process.env.POLYMARKET_FUNDER_ADDRESS || signer.address;
  const client = new ClobClient(host, chainId, signer, await creds, signatureType, funder);
  return { client, signerAddress: signer.address };
}

export async function postOrder(params: PostOrderParams): Promise<PostOrderResult> {
  try {
    const { client } = await getPolymarketClient();
    const side = normalizeSide(params.side);
    const order = await client.createAndPostOrder(
      {
        tokenID: params.tokenID,
        price: params.price,
        side,
        size: params.size,
        feeRateBps: params.feeRateBps ?? 0
      },
      { tickSize: params.tickSize as any, negRisk: params.negRisk },
      (params.timeInForce as any) ?? OrderType.GTC
    );
    return { ok: true, order };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export interface PostMarketOrderParams {
  tokenID: string;
  side: 'buy' | 'sell' | 'YES' | 'NO' | 'yes' | 'no';
  amountUSD: number; // dollar notionals
  feeRateBps?: number;
  price?: number; // optional hint
  nonce?: number;
}

export async function postMarketOrder(params: PostMarketOrderParams): Promise<PostOrderResult> {
  try {
    const { client } = await getPolymarketClient();
    const side = normalizeSide(params.side);
    const order = await client.createMarketOrder({
      side,
      tokenID: params.tokenID,
      amount: params.amountUSD,
      feeRateBps: params.feeRateBps ?? 0,
      nonce: params.nonce ?? 0,
      price: params.price ?? 0.5
    });
    try {
      const resp = await client.postOrder(order, OrderType.FOK);
      return { ok: true, order: resp };
    } catch (e: any) {
      console.error('🧩 Polymarket postOrder error', { message: e?.message });
      return { ok: false, error: e?.message || String(e) };
    }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

function normalizeSide(s: PostOrderParams['side']): Side {
  const v = String(s).toLowerCase();
  if (v === 'buy' || v === 'yes') return Side.BUY;
  if (v === 'sell' || v === 'no') return Side.SELL;
  return Side.BUY;
}
