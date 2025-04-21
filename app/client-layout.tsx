"use client"

import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle } from "react";

import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronDown, Image, BarChart2, Settings, LogOut, Activity, Wallet, Copy, Check, CreditCard, Key, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import TokenList from "./token-list"
import ActivityList from "./activity-list"
import WalletBridge from "@/components/wallet-bridge"
import "./globals.css"
import { ChatProvider, useChat } from '@/context/ChatContext';
import { shortenAddress } from "@/lib/utils"; // Import shortenAddress at the top
import { usePrivy, useWallets, useFundWallet } from "@privy-io/react-auth"; // Remove delegation hook
import { base } from "viem/chains"; // Import Base chain configuration

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
  // Use Chat context setters
  const { setIsWalletConnected, setWalletAddress } = useChat();

  // Use Privy hooks
  const { ready, authenticated, user, login, logout, exportWallet } = usePrivy();
  const { wallets } = useWallets();
  const { fundWallet } = useFundWallet(); // Add fund wallet hook

  // Specifically get Privy's embedded wallet
  const connectedWallet = wallets.find(wallet => wallet.walletClientType === 'privy');

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
  const isWalletEffectivelyConnected = ready && authenticated && !!connectedWallet;
  const displayAddress = isWalletEffectivelyConnected ? connectedWallet.address : null;

  // Update context based on Privy state
  useEffect(() => {
    if (ready) {
      setIsWalletConnected(authenticated && !!connectedWallet);
      
      if (authenticated && connectedWallet) {
        setWalletAddress(connectedWallet.address);
      } else {
        setWalletAddress(null);
      }
    }
  }, [ready, authenticated, connectedWallet, setIsWalletConnected, setWalletAddress]);

  // Handle wallet funding
  const handleFundWallet = async () => {
    if (displayAddress) {
      setIsFunding(true);
      try {
        await fundWallet(displayAddress, {
          chain: base, // Use Base network for lower fees and faster transactions
          amount: '0.01', // Default funding amount in ETH
        });
        
        // Refresh the assets to show updated balances after successful funding
        if (tabsRef.current) {
          tabsRef.current.refreshBalances();
        }
      } catch (error) {
        console.error('Funding failed:', error);
      } finally {
        setIsFunding(false);
      }
    }
  };

  // Function to copy address to clipboard
  const copyAddressToClipboard = () => {
    if (displayAddress) {
      navigator.clipboard.writeText(displayAddress)
        .then(() => {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
        })
        .catch(err => {
          console.error('Failed to copy address: ', err);
        });
    }
  };

  return (
    <aside className="w-72 bg-white rounded-2xl p-6 flex flex-col justify-between border-2 border-black" style={{ boxShadow: "8px 8px 0px 0px #000000" }}>
      <div>
        {/* Profile/Wallet Section */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow to-orange border-2 border-black flex items-center justify-center">
            <Wallet className="w-6 h-6 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold">{
                !ready ? 'Loading...' : 
                isWalletEffectivelyConnected ? 'Wallet Connected' : 'Connect Wallet'
              }</span>
              {ready && (
                <div className={`h-2 w-2 rounded-full ${isWalletEffectivelyConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              )}
            </div>
            {displayAddress && ( // Display address if connected via Privy
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
        {isWalletEffectivelyConnected && (
          <>
           <Button
             variant="outline"
             className="w-full justify-start border-2 border-black hover:bg-yellow/20 active:translate-y-1 active:shadow-none transition-all duration-100 rounded-xl font-bold"
             style={{ boxShadow: "4px 4px 0px 0px #000000" }}
             onClick={handleFundWallet}
             disabled={isFunding}
           >
             <CreditCard className="mr-2 h-4 w-4" />
             <span>{isFunding ? 'Processing...' : 'Fund Wallet'}</span>
           </Button>
          
          <Button
            variant="outline"
            className="w-full justify-start border-2 border-black hover:bg-yellow/20 active:translate-y-1 active:shadow-none transition-all duration-100 rounded-xl font-bold"
            style={{ boxShadow: "4px 4px 0px 0px #000000" }}
            onClick={() => {
              // This will open Privy's secure export modal
              if (displayAddress) {
                exportWallet({ address: displayAddress });
              } else {
                exportWallet(); // Default to first wallet if address not available
              }
            }}
          >
            <Key className="mr-2 h-4 w-4" />
            <span>Export Wallet</span>
          </Button>
          </>
         )}
        {!isWalletEffectivelyConnected && (
          <Button
            variant="outline"
            className="w-full justify-start border-2 border-black hover:bg-yellow/20 active:translate-y-1 active:shadow-none transition-all duration-100 rounded-xl font-bold"
            style={{ boxShadow: "4px 4px 0px 0px #000000" }}
            onClick={login} // Only show Connect button when not connected
          >
            <Sparkles className="mr-2 h-4 w-4" />
            <span>{!ready ? 'Loading...' : 'Sign In'}</span>
          </Button>
        )}
        <Button variant="outline" className="w-full justify-start border-2 border-black hover:bg-yellow/20 active:translate-y-1 active:shadow-none transition-all duration-100 rounded-xl font-bold" style={{ boxShadow: "4px 4px 0px 0px #000000" }}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </Button>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-red-600 hover:bg-red-100 hover:text-red-700 rounded-xl font-bold"
          onClick={() => {
            // Log the user out of Privy (which is different from just disconnecting the wallet)
            logout();
            // Reset the local wallet connection state
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
const SidebarTabs = forwardRef<{ refreshBalances: () => void }, { 
  isWalletConnected: boolean, 
  walletAddress: string | null 
}>(function SidebarTabs({ isWalletConnected, walletAddress }, ref) {
  const [activeTab, setActiveTab] = useState<'tokens' | 'activity' | 'bridge'>('tokens');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Function to refresh balances
  const refreshBalances = () => {
    setRefreshTrigger(prev => prev + 1);
  };
  
  // Expose the refreshBalances method to parent components
  useImperativeHandle(ref, () => ({
    refreshBalances
  }));

  return (
    <div>
      {/* Tab Buttons */}
      <div className="flex mb-6 p-1 bg-gray-100 rounded-xl">
        <button
          onClick={() => setActiveTab('tokens')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium ${
            activeTab === 'tokens' ? 'bg-white border-2 border-black shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Tokens
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium ${
            activeTab === 'activity' ? 'bg-white border-2 border-black shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Activity
        </button>
        <button
          onClick={() => setActiveTab('bridge')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium ${
            activeTab === 'bridge' ? 'bg-white border-2 border-black shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Bridge
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'tokens' && (
          <TokenList walletAddress={walletAddress} refreshTrigger={refreshTrigger} />
        )}
        {activeTab === 'activity' && (
          <ActivityList walletAddress={walletAddress} refreshTrigger={refreshTrigger} />
        )}
        {activeTab === 'bridge' && (
          <WalletBridge />
        )}
      </div>
    </div>
  );
});

// --- AssetsSection ---
import { type DisplayBalance } from './token-list'; // Import the type

function AssetsSection({ 
  isWalletConnected, 
  walletAddress,
  setRefreshBalancesRef
}: { 
  isWalletConnected: boolean, 
  walletAddress: string | null,
  setRefreshBalancesRef: (fn: () => void) => void
}) { // Accept address prop
  // Add state for tokens and loading
  const [tokens, setTokens] = useState<DisplayBalance[]>([]); 
  const [isLoading, setIsLoading] = useState(false); // Start not loading
  const [error, setError] = useState<string | null>(null); // Add error state
  const [showSmallBalances, setShowSmallBalances] = useState(false); // State to control small balances visibility
  
  // Calculate if we have small balances that are hidden
  const hasSmallBalances = tokens.some(token => {
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
    if (!isWalletConnected || !walletAddress) return;
    
    setIsLoading(true);
    setError(null); // Clear previous errors
    try {
      // Fetch both native and token balances concurrently
      const [nativeRes, tokenRes] = await Promise.all([
        fetch(`/api/native-balances?address=${walletAddress}`),
        fetch(`/api/tokens?address=${walletAddress}`) // Fetch from token endpoint
      ]);

      // Process Native Balances
      if (!nativeRes.ok) {
        const errorData = await nativeRes.json().catch(() => ({ error: 'Failed to parse native balance error response' }));
        throw new Error(`Native Balances Error: ${errorData.error || nativeRes.statusText}`);
      }
      const nativeBalances: DisplayBalance[] = await nativeRes.json();

      // Process Token Balances
      if (!tokenRes.ok) {
        const errorData = await tokenRes.json().catch(() => ({ error: 'Failed to parse token balance error response' }));
        throw new Error(`Token Balances Error: ${errorData.error || tokenRes.statusText}`);
      }
      const tokenData = await tokenRes.json();
      const tokenBalances: DisplayBalance[] = tokenData.tokens || []; // Access the .tokens property

      // Combine and set tokens
      setTokens([...nativeBalances, ...tokenBalances]); 

    } catch (err: any) {
      console.error("Error fetching balances:", err);
      setError(err.message || 'Failed to fetch balances.');
      setTokens([]); // Clear tokens on error
    } finally {
      setIsLoading(false);
    }
  };

  // Register the refresh function with the parent component
  useEffect(() => {
    setRefreshBalancesRef(() => fetchAllBalances);
  }, [setRefreshBalancesRef]);

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
            style={{ boxShadow: "2px 2px 0px 0px #000000" }}
          >
            <BarChart2 className="h-4 w-4" />
          </Button>
        </div>
        {/* Pass the state down to TokenList */}
        <TokenList tokens={tokens} isLoading={isLoading} showSmallBalances={showSmallBalances} /> 
        {/* Display error message if fetch fails */}
        {error && <p className="text-sm text-red-600 text-center mt-2">Error: {error}</p>}
        {isWalletConnected && !isLoading && tokens.length > 0 && hasSmallBalances && ( // Show button only if there are small balances
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start mt-4 border-2 border-black hover:bg-yellow/20 active:translate-y-1 active:shadow-none transition-all duration-100 rounded-xl font-bold"
            style={{ boxShadow: "4px 4px 0px 0px #000000" }}
            onClick={() => setShowSmallBalances(!showSmallBalances)}
          >
            <span>{showSmallBalances ? 'Hide Small Balances' : 'Show Small Balances'}</span>
            <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${showSmallBalances ? 'rotate-180' : ''}`} />
          </Button>
        )}
      </div>
      <div className="pt-4 border-t-2 border-black">
        <Button
          variant="outline"
          className="w-full justify-start border-2 border-black hover:bg-yellow/20 active:translate-y-1 active:shadow-none transition-all duration-100 rounded-xl font-bold"
          style={{ boxShadow: "4px 4px 0px 0px #000000" }}
        >
          <Image className="mr-2 h-4 w-4" />
          <span>NFTs</span>
          <ChevronDown className="ml-auto h-4 w-4" />
        </Button>
      </div>
    </div>
  )
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
          style={{ boxShadow: "2px 2px 0px 0px #000000" }}
        >
          {/* Add icon maybe? */}
        </Button>
      </div>
      <ActivityList />
    </div>
  )
}
