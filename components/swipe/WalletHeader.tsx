'use client';

import { Copy, Menu, DollarSign } from 'lucide-react';
import React from 'react';

interface WalletHeaderProps {
  walletAddress: string | null;
  onCopy: () => void;
  copied: boolean;
  balance: string | null;
  topUpHref?: string;
  menuButton?: React.ReactNode;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function WalletHeader({
  walletAddress,
  onCopy,
  copied,
  balance,
  topUpHref = 'https://faucet.circle.com',
  menuButton,
  onConnect,
  onDisconnect
}: WalletHeaderProps) {
  return (
    <header className="relative w-full">
      <div className="relative flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        {/* Left Section - Wallet & Balance */}
        <div className="flex flex-1 flex-col gap-2 sm:gap-3">
          {/* Wallet Address Card */}
          <div className="flex items-center gap-2 rounded-xl border-[4px] border-black bg-[#FFF8F0] p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:rounded-2xl sm:border-[5px] sm:p-3">
            {walletAddress ? (
              <>
                <span className="flex-1 text-sm font-bold text-black sm:text-base">
                  {walletAddress}
                </span>
                <button
                  onClick={onCopy}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-3 border-black bg-[#FF6B35] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none sm:h-10 sm:w-10 sm:rounded-xl sm:border-4 sm:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                  aria-label="Copy wallet address"
                >
                  <Copy className="h-4 w-4 text-white sm:h-5 sm:w-5" />
                </button>
                <button
                  onClick={onDisconnect}
                  className="ml-1 flex items-center justify-center rounded-xl border-[3px] border-black bg-white px-3 py-1 text-xs font-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none sm:text-sm"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={onConnect}
                className="ml-auto flex items-center justify-center rounded-xl border-[4px] border-black bg-[#FF6B35] px-4 py-2 text-base font-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[5px] active:translate-y-[5px] active:shadow-none sm:px-5 sm:py-3"
              >
                Connect
              </button>
            )}
          </div>

          {/* Balance Card - Prominent Display */}
          <div className="flex items-center gap-2 rounded-xl border-[4px] border-black bg-[#D50A0A] p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:gap-3 sm:rounded-2xl sm:border-[5px] sm:p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-3 border-black bg-[#FFD700] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] sm:h-12 sm:w-12 sm:rounded-xl sm:border-4">
              <DollarSign className="h-6 w-6 text-black sm:h-7 sm:w-7" strokeWidth={3} />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black leading-none text-white sm:text-2xl">
                {balance ?? '—'}
              </span>
              <span className="text-xs font-bold text-[#FFF8F0] sm:text-sm">USDC</span>
            </div>
          </div>
        </div>

        {/* Right Section - Top Up and Menu */}
        <div className="flex flex-row items-stretch gap-2 sm:w-auto sm:gap-3">
          {/* Top Up Button */}
          <a href={topUpHref} target="_blank" rel="noreferrer" className="flex-1 sm:w-auto">
            <button className="flex w-full items-center justify-center rounded-xl border-[4px] border-black bg-[#FF6B35] px-4 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[5px] active:translate-y-[5px] active:shadow-none sm:w-32 sm:flex-col sm:rounded-2xl sm:border-[5px] sm:px-4 sm:py-6">
              <span className="whitespace-nowrap text-base font-black text-white sm:text-lg sm:[writing-mode:vertical-rl]">
                Top Up
              </span>
            </button>
          </a>

          {/* Menu Button */}
          {menuButton ?? (
            <button
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-[4px] border-black bg-[#34302B] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[5px] active:translate-y-[5px] active:shadow-none sm:h-auto sm:w-16 sm:rounded-2xl sm:border-[5px]"
              aria-label="Menu"
            >
              <Menu className="h-6 w-6 text-white sm:h-8 sm:w-8" strokeWidth={3} />
            </button>
          )}
        </div>
      </div>

      {/* Copy Confirmation Toast */}
      {copied && (
        <div className="absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-xl border-[4px] border-black bg-[#4ADE80] px-5 py-2 text-base font-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] sm:rounded-2xl sm:border-[5px] sm:px-6 sm:py-3 sm:text-lg">
          Copied!
        </div>
      )}
    </header>
  );
}
