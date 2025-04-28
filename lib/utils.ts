import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { createCoin } from '@zoralabs/coins-sdk';
import { Address, createPublicClient, http, Hex, WalletClient, PublicClient } from 'viem';
import { baseSepolia } from 'viem/chains';

type CoinParams = {
  name: string;
  symbol: string;
  uri: string;
  payoutRecipient: Address;
  platformReferrer?: Address;
  initialPurchaseWei: bigint;
}

export async function createMyCoin(
  params: CoinParams,
  walletClient: WalletClient,
  publicClient: PublicClient
) {
  if (!params.name || !params.symbol || !params.uri || !params.payoutRecipient) {
    throw new Error("Missing required coin parameters (name, symbol, uri, payoutRecipient).");
  }
  if (params.payoutRecipient === '0xYourAddress') {
    console.warn("createMyCoin called with placeholder payoutRecipient address.");
  }

  try {
    const result = await createCoin(params, walletClient, publicClient);

    console.log('Coin creation successful!');
    console.log('Transaction hash:', result.hash);
    console.log('Coin address:', result.address);
    console.log('Deployment details:', result.deployment);

    return result;
  } catch (error) {
    console.error('Error creating coin:', error);
    throw error;
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function shortenAddress(address: string | undefined, chars = 4): string {
  if (!address) return "";
  if (address.length <= chars * 2 + 2) return address;
  return `${address.substring(0, chars + 2)}...${address.substring(address.length - chars)}`;
}

/**
 * Formats a number into an approximate string representation with suffixes (K, M, B, T).
 * Handles large numbers and provides reasonable precision for smaller numbers.
 * 
 * @param value The number to format (can be string or number).
 * @param maxDecimals Maximum decimal places for numbers < 1000.
 * @returns The formatted string (e.g., "1.23K", "45.6M", "789.1", "0.123"). Returns "0" if input is invalid.
 */
export function formatApproximateValue(value: string | number | null | undefined, maxDecimals = 3): string {
  if (value === null || value === undefined) return "0";

  let num: number;
  if (typeof value === 'string') {
    num = parseFloat(value);
    if (isNaN(num)) return "0"; 
  } else {
    num = value;
  }

  if (num === 0) return "0";

  const absNum = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (absNum < 0.0001) { 
    return num.toExponential(2); 
  } 
  
  if (absNum < 1) { 
      return sign + absNum.toFixed(maxDecimals).replace(/\.?0+$/, ""); 
  }
  
  if (absNum < 1000) { 
    return sign + absNum.toFixed(maxDecimals).replace(/\.0+$/, ""); 
  }

  const tier = Math.floor(Math.log10(absNum) / 3);

  if (tier === 0) return sign + absNum.toFixed(1); 
  if (tier >= 5) return num.toExponential(2); 
  
  const suffix = ['', 'K', 'M', 'B', 'T'][tier];
  const scale = Math.pow(10, tier * 3);
  const scaled = absNum / scale;

  let formattedScaled: string;
  if (scaled < 10) {
      formattedScaled = scaled.toFixed(2);
  } else if (scaled < 100) {
      formattedScaled = scaled.toFixed(1);
  } else {
      formattedScaled = scaled.toFixed(0);
  }
  
  formattedScaled = formattedScaled.replace(/\.0+$/, ""); 

  return sign + formattedScaled + suffix;
}