import { ClobClient, Side, OrderType, type ApiKeyCreds } from '@polymarket/clob-client';
import { Wallet } from 'ethers';

export interface PostOrderParams {
  tokenID: string;
  price: number; // 0-1
  side: 'buy' | 'sell' | 'YES' | 'NO' | 'yes' | 'no';
  size: number; // in tokens (USDC notionals depend on price)
  feeRateBps?: number; // default 0
  tickSize: string; // e.g. '0.001'
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
  const creds: Promise<ApiKeyCreds> = new ClobClient(host, chainId, signer).createOrDeriveApiKey();
  const signatureType = 0; // 0: EOA
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
      { tickSize: params.tickSize, negRisk: params.negRisk },
      params.timeInForce ?? OrderType.GTC
    );
    return { ok: true, order };
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
