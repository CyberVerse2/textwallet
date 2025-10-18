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
      <div className="relative flex flex-col gap-2">
        {/* Left Section - Wallet & Balance */}
        <div className="flex flex-1 flex-col gap-2 sm:gap-3">
          {/* Wallet Address Card */}
          <div className="flex items-center gap-2 rounded-lg border-[3px] border-black bg-[#FFF8F0] p-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] sm:rounded-xl sm:border-[4px] sm:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:rounded-2xl md:border-[5px] md:p-3">
            {walletAddress ? (
              <>
                <span className="flex-1 text-sm font-bold text-black sm:text-base">
                  {walletAddress}
                </span>
                <button
                  onClick={onCopy}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 border-black bg-[#FF6B35] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none sm:h-8 sm:w-8 sm:rounded-lg sm:border-3 sm:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] md:h-10 md:w-10 md:rounded-xl md:border-4 md:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                  aria-label="Copy wallet address"
                >
                  <Copy className="h-3 w-3 text-white sm:h-4 sm:w-4 md:h-5 md:w-5" />
                </button>
                <button
                  onClick={onDisconnect}
                  className="ml-1 flex items-center justify-center rounded-lg border-2 border-black bg-white px-2 py-1 text-xs font-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none sm:rounded-xl sm:border-3 sm:px-3 sm:text-sm"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={onConnect}
                className="ml-auto flex items-center justify-center rounded-lg border-[3px] border-black bg-[#FF6B35] px-3 py-2 text-sm font-black text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none sm:rounded-xl sm:border-[4px] sm:px-4 sm:text-base sm:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:px-5 md:py-3"
              >
                Connect
              </button>
            )}
          </div>

          {/* Balance Card - Prominent Display with Top Up and Menu */}
          <div className="flex items-center gap-2 rounded-lg border-[3px] border-black bg-[#D50A0A] p-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] sm:gap-3 sm:rounded-xl sm:border-[4px] sm:p-3 sm:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:rounded-2xl md:border-[5px] md:p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2 border-black bg-[#FFD700] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] sm:h-10 sm:w-10 sm:rounded-lg sm:border-3 md:h-12 md:w-12 md:rounded-xl md:border-4">
              <DollarSign
                className="h-5 w-5 text-black sm:h-6 sm:w-6 md:h-7 md:w-7"
                strokeWidth={3}
              />
            </div>
            <div className="flex flex-1 flex-col">
              <span className="text-lg font-black leading-none text-white sm:text-xl md:text-2xl">
                {balance ?? '—'}
              </span>
              <span className="text-xs font-bold text-[#FFF8F0] sm:text-sm">USDC</span>
            </div>

            {/* Top Up and Menu Buttons - Always visible */}
            <div className="flex items-center gap-2">
              {/* Top Up Button */}
              <a href={topUpHref} target="_blank" rel="noreferrer">
                <button className="flex items-center justify-center rounded-md border-2 border-black bg-[#FF6B35] px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none sm:rounded-lg sm:border-3 sm:px-3 sm:py-2 sm:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] md:rounded-xl md:border-4 md:px-4 md:py-3 md:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                  <span className="text-xs font-black text-white sm:text-sm md:text-base">
                    Top Up
                  </span>
                </button>
              </a>

              {/* Menu Button */}
              {menuButton ?? (
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-md border-2 border-black bg-[#34302B] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none sm:h-10 sm:w-10 sm:rounded-lg sm:border-3 sm:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] md:h-12 md:w-12 md:rounded-xl md:border-4 md:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                  aria-label="Menu"
                >
                  <Menu
                    className="h-4 w-4 text-white sm:h-5 sm:w-5 md:h-6 md:w-6"
                    strokeWidth={3}
                  />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Copy Confirmation Toast */}
      {copied && (
        <div className="absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-lg border-[3px] border-black bg-[#4ADE80] px-4 py-2 text-sm font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:rounded-xl sm:border-[4px] sm:px-5 sm:py-2 sm:text-base md:rounded-2xl md:border-[5px] md:px-6 md:py-3 md:text-lg">
          Copied!
        </div>
      )}
    </header>
  );
}
