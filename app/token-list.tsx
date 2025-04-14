"use client"

import { useState } from "react"
import { cn, formatApproximateValue, shortenAddress } from "@/lib/utils"
import React from 'react';
import Image from 'next/image';
import { Skeleton } from "@/components/ui/skeleton"; 
import type { NativeBalance } from "./api/native-balances/route"; 
 
export interface EnrichedTokenBalance {
  network: string; 
  contractAddress: string | null; // Allow null for native type check
  balanceRaw?: string; // Keep raw hex balance (optional now)
  formattedBalance?: string; // Human-readable balance
  name?: string;
  symbol?: string;
  decimals?: number;
  logo?: string;
  usdPricePerToken?: number | null; 
  usdValue?: number | null; // Calculated USD value for the balance held
  isNative?: false; // Explicitly mark ERC20 as not native
}
 
export type DisplayBalance = EnrichedTokenBalance | NativeBalance;
 
export function isNativeBalance(item: DisplayBalance): item is NativeBalance {
  return item.isNative === true;
}
 
interface TokenListProps {
  tokens: DisplayBalance[];
  isLoading: boolean;
  showSmallBalances?: boolean; // Add prop to control visibility of small balances
}

// Function to determine if a balance is considered "small"
const isSmallBalance = (token: DisplayBalance): boolean => {
  // Consider a balance small if its USD value is less than $0.1
  if (typeof token.usdValue === 'number' && token.usdValue < 0.1) {
    return true;
  }
  
  // For tokens without USD value, check the formatted balance
  // This is a simple heuristic - you may want to adjust based on token type
  const balance = parseFloat(token.formattedBalance || '0');
  if (isNativeBalance(token)) {
    // For native tokens (ETH), less than 0.001 is small
    return balance < 0.001;
  }
  
  // For other tokens, less than 1 is small
  return balance < 1;
};

const TokenList: React.FC<TokenListProps> = React.memo(({ tokens, isLoading, showSmallBalances = false }) => {
  // Filter tokens to remove small balances if not showing them
  const filteredTokens = showSmallBalances 
    ? tokens 
    : tokens.filter(token => !isSmallBalance(token));

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="flex items-center justify-between p-3 rounded-xl border-2 border-black" style={{ boxShadow: "4px 4px 0px 0px #000000" }}>
            <div className="flex items-center space-x-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
            <div className="text-right space-y-1">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-3 w-10" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!tokens || tokens.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">No token assets found in wallet.</p>;
  }

  // Display message if all balances are small and filtered out
  if (!showSmallBalances && filteredTokens.length === 0 && tokens.length > 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">Only small balances found. Click "Show More" to view them.</p>;
  }

  return (
    <div className="space-y-3">
      {filteredTokens.map((item, index) => (
        <div
          // Use a more robust key combining properties
          key={isNativeBalance(item) ? `${item.networkName}-${item.symbol}` : item.contractAddress || `${item.symbol}-${index}`}
          className="flex items-center justify-between  w-full rounded-xl border-2 border-black hover:bg-neutral-100 transition-colors duration-150 cursor-pointer"
          style={{ boxShadow: "4px 4px 0px 0px #000000" }}
          // Optional: Add onClick handler, e.g., to show details
          // onClick={() => console.log('Clicked on:', token)}
        >
          <div className="flex items-center space-x-2  w-full p-3 justify-between"> {/* Removed justify-between from here */}
            <div className="flex items-center space-x-3 overflow-hidden flex-grow min-w-0 "> {/* Ensure flex item can shrink */}
              {/* Display Logo using Next/Image if available, otherwise show placeholder */}
              {item.logo ? (
                <Image
                  src={item.logo}
                  // Use network name for native ETH alt text
                  alt={isNativeBalance(item) ? `ETH on ${item.networkName}` : item.symbol || 'Token logo'}
                  width={32} // Standard size, adjust if needed
                  height={32}
                  className="rounded-full border border-neutral-700 flex-shrink-0" // Added flex-shrink-0
                  unoptimized // Necessary for external, dynamic URLs without config
                  onError={(e) => { 
                    // Optional: Hide image or show fallback on error
                    e.currentTarget.style.display = 'none'; 
                    // TODO: Optionally replace with a fallback div here
                  }} 
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center font-bold text-muted-foreground border border-neutral-700">?</div>
              )}
              <div className="overflow-hidden">
                {/* Display Symbol (and Network for Native ETH) */}
                <div className="font-semibold truncate">
                  {item.symbol || 'Unknown'}
                  {isNativeBalance(item) && <span className="text-xs text-muted-foreground ml-1">({item.networkName})</span>}
                </div>
                {/* Display Name or Fallback Address */}
                <div className="text-xs text-muted-foreground truncate">
                  {isNativeBalance(item) 
                    ? 'Native Balance' 
                    : item.name || (item.contractAddress ? shortenAddress(item.contractAddress) : '-')} 
                </div>
              </div>
            </div>
 
            {/* Balance & Value */}
            <div className="text-right flex-shrink-0 ml-auto pl-2"> {/* Added ml-auto and kept pl-2 */}
              {/* Use the formatting utility for the balance */}
              {/* Add original balance to title attribute for hover */}
              <div className="font-medium truncate" title={item.formattedBalance || '0'}>
                {formatApproximateValue(item.formattedBalance)}
              </div>
              {/* Display USD Value */}
              {typeof item.usdValue === 'number' ? (
                <div className="text-xs text-muted-foreground">${item.usdValue.toFixed(2)}</div>
              ) : (
                <div className="text-xs text-muted-foreground">-</div> // Show dash if no USD value
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

TokenList.displayName = 'TokenList';

export default TokenList;
