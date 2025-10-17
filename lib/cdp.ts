// CDP utilities used from API routes (server only)

import { CdpClient } from '@coinbase/cdp-sdk';
import { Address, createPublicClient, erc20Abi, http, parseUnits } from 'viem';
import { base, baseSepolia, polygon } from 'viem/chains';

export type SupportedEvmNetwork = 'base' | 'base-sepolia' | 'polygon';

const DEFAULT_USDC_ADDRESSES: Record<SupportedEvmNetwork, Address> = {
  // Base mainnet USDC
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  // Base Sepolia USDC (provided by user)
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  // Polygon USDC.e
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'
};

export function getUsdcAddress(network: SupportedEvmNetwork): Address {
  let envKey: string | undefined;
  if (network === 'base') envKey = process.env.USDC_BASE_ADDRESS;
  else if (network === 'base-sepolia') envKey = process.env.USDC_BASE_SEPOLIA_ADDRESS;
  else envKey = process.env.USDC_POLYGON_ADDRESS;
  const fallback = DEFAULT_USDC_ADDRESSES[network];
  return (envKey as Address) || fallback;
}

export function getCdpClient(): CdpClient {
  // CdpClient reads CDP_API_KEY_ID / CDP_API_KEY_SECRET / CDP_WALLET_SECRET from env
  return new CdpClient();
}

export async function getServerWalletAddress(): Promise<Address> {
  if (process.env.CDP_SERVER_EVM_ADDRESS) {
    return process.env.CDP_SERVER_EVM_ADDRESS as Address;
  }
  const cdp = getCdpClient();
  // Create one EVM account if none set in env
  const account = await cdp.evm.createAccount();
  return account.address as Address;
}

export function getPublicClient(network: SupportedEvmNetwork) {
  const chain = network === 'base' ? base : network === 'base-sepolia' ? baseSepolia : polygon;
  return createPublicClient({ chain, transport: http() });
}

export async function getUsdcBalance(network: SupportedEvmNetwork, owner: Address) {
  const client = getPublicClient(network);
  const usdc = getUsdcAddress(network);
  const [balance, decimals] = await Promise.all([
    client.readContract({
      address: usdc,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [owner]
    }) as Promise<bigint>,
    client.readContract({
      address: usdc,
      abi: erc20Abi,
      functionName: 'decimals'
    }) as Promise<number>
  ]);
  return { balance, decimals };
}

export async function buildUsdcTransferData(to: Address, amount: bigint) {
  // ERC-20 transfer(to, amount)
  const data = (await import('viem')).encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [to, amount]
  });
  return data as `0x${string}`;
}

export async function prepareUsdcTransferTx(
  network: SupportedEvmNetwork,
  to: Address,
  amountUnits: string
) {
  const usdc = getUsdcAddress(network);
  const decimals = 6; // USDC
  const amount = parseUnits(amountUnits, decimals);
  const data = await buildUsdcTransferData(to, amount);
  return {
    to: usdc,
    data
  };
}
