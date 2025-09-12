'use client';

import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  ChevronDown,
  Image,
  BarChart2,
  Settings,
  LogOut,
  Activity,
  Wallet,
  Copy,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import TokenList from './token-list';
import ActivityList from './activity-list';
import './globals.css';
import { ChatProvider, useChatContext } from '@/context/ChatContext';
import { shortenAddress } from '@/lib/utils'; // Import shortenAddress at the top
import { EnrichedTokenBalance } from './token-list'; // Import the correct type
import { useAccount, useDisconnect } from 'wagmi';
import { SignInWithBaseButton } from '@base-org/account-ui/react';
import { signInWithBase } from '@/lib/baseAuth';

// Create a ref to hold the SidebarTabs component
const sidebarRef = React.createRef<{ refreshBalances: () => void }>();

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      <div className="flex h-screen bg-background p-6 overflow-hidden">
        <div className="w-full mx-auto flex gap-6 h-full">
          {/* Sidebar */}
          <Sidebar ref={sidebarRef} />

          {/* Main Content */}
          <div
            className="flex-1 bg-white rounded-2xl overflow-hidden flex flex-col relative"
            style={{ boxShadow: '8px 8px 0px 0px #000000' }}
          >
            {children}
          </div>
        </div>
      </div>
    </ChatProvider>
  );
}

interface SidebarProps {
  // ... (props if any)
}

// Create a forwardRef component for Sidebar to properly handle refs
const Sidebar = forwardRef<{ refreshBalances: () => void }, {}>(function Sidebar(props, ref) {
  // Use Chat context setters and Wagmi account
  const { setIsWalletConnected, setWalletAddress } = useChatContext();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  // State for copy address button
  const [isCopied, setIsCopied] = useState(false);
  // State for funding
  const [isFunding, setIsFunding] = useState(false);
  // Create a ref to the SidebarTabs component to access the refresh function
  const tabsRef = useRef<{ refreshBalances: () => void } | null>(null);

  // Expose the refreshBalances method to parent components
  useImperativeHandle(ref, () => ({
    refreshBalances: () => {
      if (tabsRef.current) {
        tabsRef.current.refreshBalances();
      }
    }
  }));

  // Derived state for UI
  const isWalletEffectivelyConnected = isConnected;
  const displayAddress = isConnected ? address ?? null : null;

  // Update context based on Wagmi state
  useEffect(() => {
    setIsWalletConnected(isConnected);
    setWalletAddress(isConnected ? address ?? null : null);
  }, [address, isConnected, setIsWalletConnected, setWalletAddress]);

  // Funding/export actions removed with Privy
  const handleFundWallet = async () => {};

  // Function to copy address to clipboard
  const copyAddressToClipboard = () => {
    if (displayAddress) {
      navigator.clipboard
        .writeText(displayAddress)
        .then(() => {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
        })
        .catch((err) => {
          console.error('Failed to copy address: ', err);
        });
    }
  };

  return (
    <aside
      className="w-72 bg-white rounded-2xl p-4 flex flex-col justify-between border-2 border-black"
      style={{ boxShadow: '8px 8px 0px 0px #000000' }}
    >
      <div>
        {/* Profile/Wallet Section */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow to-orange border-2 border-black flex items-center justify-center">
            <Wallet className="w-6 h-6 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold">
                {isWalletEffectivelyConnected ? 'Wallet Connected' : 'Connect Wallet'}
              </span>
              <div
                className={`h-2 w-2 rounded-full ${
                  isWalletEffectivelyConnected ? 'bg-green-500' : 'bg-red-500'
                }`}
              ></div>
            </div>
            {displayAddress && (
              <div className="flex items-center gap-1">
                <div className="text-sm text-muted-foreground truncate" title={displayAddress}>
                  {shortenAddress(displayAddress)}
                </div>
                <button
                  onClick={copyAddressToClipboard}
                  className="ml-1 p-1 hover:bg-yellow/20 rounded-full transition-colors"
                  title="Copy wallet address"
                >
                  {isCopied ? (
                    <Check className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-gray-500" />
                  )}
                </button>
              </div>
            )}
            {/* Connect UI handled by pinned Base button at bottom */}
          </div>
        </div>

        {/* Navigation Tabs - Pass address down */}
        <SidebarTabs
          ref={tabsRef}
          isWalletConnected={isWalletEffectivelyConnected}
          walletAddress={displayAddress}
        />
      </div>

      {/* Bottom Actions */}
      <div className="space-y-2">
        {isWalletEffectivelyConnected ? (
          <>
            <Button
              variant="outline"
              className="w-full justify-start border-2 border-black hover:bg-yellow/20 active:translate-y-1 active:shadow-none transition-all duration-100 rounded-xl font-bold"
              style={{ boxShadow: '4px 4px 0px 0px #000000' }}
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </Button>
          </>
        ) : (
          <div className="w-full">
            <SignInWithBaseButton
              colorScheme="light"
              onClick={async () => {
                const result = await signInWithBase();
                if (result) {
                  // trigger state update if needed; Wagmi will reflect connection
                }
              }}
            />
          </div>
        )}
        <Button
          variant="outline"
          className="w-full justify-start text-red-500 border-2 border-red-500 hover:bg-red-50 active:translate-y-1 active:shadow-none transition-all duration-100 rounded-xl font-bold"
          style={{ boxShadow: '3px 3px 0px 0px #dc2626' }}
          onClick={() => {
            disconnect();
            setIsWalletConnected(false);
            setWalletAddress(null);
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log Out</span>
        </Button>
      </div>
    </aside>
  );
});

// --- SidebarTabs Component --- (Keep as is for now)

// Convert SidebarTabs to use forwardRef
const SidebarTabs = forwardRef<
  { refreshBalances: () => void },
  {
    isWalletConnected: boolean;
    walletAddress: string | null;
  }
>(function SidebarTabs({ isWalletConnected, walletAddress }, ref) {
  const [activeTab, setActiveTab] = useState<'tokens' | 'activity'>('tokens');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Function to refresh balances
  const refreshBalances = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Expose the refreshBalances method to parent components
  useImperativeHandle(ref, () => ({
    refreshBalances
  }));

  return (
    <div>
      {/* Tab Buttons - Updated Styling */}
      <div className="flex mb-6 p-1 border-2 border-black rounded-xl">
        <button
          className={`flex-1 py-2 px-4 rounded-lg font-bold transition-all duration-150 flex items-center justify-center gap-2 ${
            activeTab === 'tokens'
              ? 'bg-yellow text-black border-2 border-black'
              : 'text-black hover:bg-yellow/50 active:translate-y-px'
          }`}
          style={activeTab === 'tokens' ? { boxShadow: '2px 2px 0px 0px #000000' } : {}}
          onClick={() => setActiveTab('tokens')}
        >
          <Wallet className="h-4 w-4" /> Tokens
        </button>
        <button
          className={`flex-1 py-2 px-4 rounded-lg font-bold transition-all duration-150 flex items-center justify-center gap-2 ${
            activeTab === 'activity'
              ? 'bg-yellow text-black border-2 border-black'
              : 'text-black hover:bg-yellow/50 active:translate-y-px'
          }`}
          style={activeTab === 'activity' ? { boxShadow: '2px 2px 0px 0px #000000' } : {}}
          onClick={() => setActiveTab('activity')}
        >
          <Activity className="h-4 w-4" /> Activity
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'tokens' && (
          <AssetsSection isWalletConnected={isWalletConnected} walletAddress={walletAddress} />
        )}
        {activeTab === 'activity' && (
          <ActivityList walletAddress={walletAddress} refreshTrigger={refreshTrigger} />
        )}
      </div>
    </div>
  );
});

// --- AssetsSection ---
function AssetsSection({
  isWalletConnected,
  walletAddress
}: {
  isWalletConnected: boolean;
  walletAddress: string | null;
}) {
  // Accept address prop
  // Add state for tokens and loading
  const [tokens, setTokens] = useState<EnrichedTokenBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false); // Start not loading
  const [error, setError] = useState<string | null>(null); // Add error state
  const [showSmallBalances, setShowSmallBalances] = useState(false); // State to control small balances visibility

  // Calculate if we have small balances that are hidden
  const hasSmallBalances = tokens.some((token) => {
    // Consider a balance small if its USD value is less than $0.1
    if (typeof token.usdValue === 'number' && token.usdValue < 0.1) {
      return true;
    }

    // For tokens without USD value, check the formatted balance
    const balance = parseFloat(token.formattedBalance || '0');
    if ((token as any).isNative === true) {
      // For native tokens (ETH), less than 0.001 is small
      return balance < 0.001;
    }

    // For other tokens, less than 1 is small
    return balance < 1;
  });

  // Create a function to fetch all balances that can be called from other components
  const fetchAllBalances = async () => {
    if (!walletAddress) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nativeUrl = `/api/native-balances?address=${walletAddress}`;
      const tokenUrl = `/api/tokens?address=${walletAddress}`;

      const [nativeRes, tokenRes] = await Promise.all([fetch(nativeUrl), fetch(tokenUrl)]);

      const nativeData: EnrichedTokenBalance | null = await nativeRes.json();
      const tokenData: { tokens: EnrichedTokenBalance[] } | null = await tokenRes.json();

      const nativeToken = nativeData;
      const erc20Tokens = tokenData?.tokens || [];

      let combinedTokens = nativeToken ? [nativeToken, ...erc20Tokens] : erc20Tokens;

      // Filter out tokens with null USD value BEFORE sorting
      combinedTokens = combinedTokens.filter(
        (token: EnrichedTokenBalance) =>
          typeof token.usdPricePerToken === 'number' && token.usdPricePerToken > 0
      );

      // Sort by USD value, descending
      combinedTokens.sort(
        (a: EnrichedTokenBalance, b: EnrichedTokenBalance) => (b.usdValue ?? 0) - (a.usdValue ?? 0)
      );

      setTokens(combinedTokens);
    } catch (err: any) {
      setError(`Failed to fetch balances: ${err.message}`);
      setTokens([]); // Clear tokens on error
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data when the wallet is connected and address is available
  useEffect(() => {
    if (isWalletConnected && walletAddress) {
      fetchAllBalances();
    } else {
      // Clear tokens and errors if wallet disconnects or no address
      setTokens([]);
      setIsLoading(false);
      setError(null);
    }
  }, [isWalletConnected, walletAddress]); // Re-run effect when connection or address changes

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Assets</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-yellow/20 active:translate-y-1 active:shadow-none transition-all duration-100 border-2 border-black rounded-lg"
            style={{ boxShadow: '2px 2px 0px 0px #000000' }}
          >
            <BarChart2 className="h-4 w-4" />
          </Button>
        </div>
        {/* Pass the state down to TokenList */}
        <TokenList tokens={tokens} isLoading={isLoading} showSmallBalances={showSmallBalances} />
        {/* Display error message if fetch fails */}
        {error && <p className="text-sm text-red-600 text-center mt-2">Error: {error}</p>}
        {isWalletConnected &&
          !isLoading &&
          tokens.length > 0 &&
          hasSmallBalances && ( // Show button only if there are small balances
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start mt-4 border-2 border-black hover:bg-yellow/20 active:translate-y-1 active:shadow-none transition-all duration-100 rounded-xl font-bold"
              style={{ boxShadow: '4px 4px 0px 0px #000000' }}
              onClick={() => setShowSmallBalances(!showSmallBalances)}
            >
              <span>{showSmallBalances ? 'Hide Small Balances' : 'Show Small Balances'}</span>
              <ChevronDown
                className={`ml-auto h-4 w-4 transition-transform ${
                  showSmallBalances ? 'rotate-180' : ''
                }`}
              />
            </Button>
          )}
      </div>
      <div className="pt-4 border-t-2 border-black">
        <Button
          variant="outline"
          className="w-full justify-start border-2 border-black hover:bg-yellow/20 active:translate-y-1 active:shadow-none transition-all duration-100 rounded-xl font-bold"
          style={{ boxShadow: '4px 4px 0px 0px #000000' }}
        >
          <Image className="mr-2 h-4 w-4" />
          <span>NFTs</span>
          <ChevronDown className="ml-auto h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// --- ActivitySection --- (Keep as is)
function ActivitySection() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg">Recent Activity</h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-yellow/20 active:translate-y-1 active:shadow-none transition-all duration-100 border-2 border-black rounded-lg"
          style={{ boxShadow: '2px 2px 0px 0px #000000' }}
        >
          {/* Add icon maybe? */}
        </Button>
      </div>
      <ActivityList />
    </div>
  );
}
