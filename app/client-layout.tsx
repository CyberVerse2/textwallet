"use client"

import type React from "react";
import { useEffect, useState } from "react";

import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronDown, Image, BarChart2, Settings, LogOut, Activity, Wallet, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import TokenList from "./token-list"
import ActivityList from "./activity-list"
import "./globals.css"
import { ChatProvider, useChat } from '@/context/ChatContext';
import { shortenAddress } from "@/lib/utils"; // Import shortenAddress at the top
import { usePrivy, useWallets } from "@privy-io/react-auth"; // Import Privy hooks

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      <div className="flex h-screen bg-background p-6 overflow-hidden">
        <div className="max-w-6xl w-full mx-auto flex gap-6 h-full">
          {/* Sidebar */}
          <Sidebar />

          {/* Main Content */}
          <div
            className="flex-1 bg-white rounded-2xl overflow-hidden flex flex-col relative"
            style={{ boxShadow: "8px 8px 0px 0px #000000" }}
          >
            {/* Header */}
            <header className="p-6 border-b">
              <h1 className="font-bold text-xl">Text Wallet Assistant</h1>
            </header>
            {children}
          </div>
        </div>
      </div>
    </ChatProvider>
  )
}

interface SidebarProps {
  // ... (props if any)
}

function Sidebar(/*{}: SidebarProps*/) {
  // Use Chat context setters
  const { setIsWalletConnected, setWalletAddress } = useChat();

  // Use Privy hooks
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();

  // Specifically get Privy's embedded wallet
  const connectedWallet = wallets.find(wallet => wallet.walletClientType === 'privy');

  // State for copy address button
  const [isCopied, setIsCopied] = useState(false);

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

  // Update context based on Privy state
  useEffect(() => {
    if (ready) {
      setIsWalletConnected(authenticated && !!connectedWallet);
      setWalletAddress(authenticated && connectedWallet ? connectedWallet.address : null);
    }
  }, [ready, authenticated, connectedWallet, setIsWalletConnected, setWalletAddress]);

  // Derived state for UI
  const isWalletEffectivelyConnected = ready && authenticated && !!connectedWallet;
  const displayAddress = isWalletEffectivelyConnected ? connectedWallet.address : null;

  // Simulate connecting/disconnecting wallet
  const toggleWalletConnection = () => {
    if (isWalletEffectivelyConnected) {
      logout(); // Use Privy logout
    } else {
      login(); // Use Privy login
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
        <SidebarTabs isWalletConnected={isWalletEffectivelyConnected} walletAddress={displayAddress} /> {/* Pass state down */}
      </div>

      {/* Bottom Actions */}
      <div className="space-y-2">
        <Button
          variant="outline"
          className="w-full justify-start border-2 border-black hover:bg-yellow/20 active:translate-y-1 active:shadow-none transition-all duration-100 rounded-xl font-bold"
          style={{ boxShadow: "4px 4px 0px 0px #000000" }}
          onClick={toggleWalletConnection} // Button to toggle connection
        >
          <Wallet className="mr-2 h-4 w-4" />
          <span>{
            !ready ? 'Loading...' : 
            isWalletEffectivelyConnected ? 'Disconnect Wallet' : 'Connect Wallet'
          }</span>
        </Button>
        <Button variant="outline" className="w-full justify-start border-2 border-black hover:bg-yellow/20 active:translate-y-1 active:shadow-none transition-all duration-100 rounded-xl font-bold" style={{ boxShadow: "4px 4px 0px 0px #000000" }}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </Button>
        <Button variant="ghost" className="w-full justify-start text-red-600 hover:bg-red-100 hover:text-red-700 rounded-xl font-bold">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log Out</span>
        </Button>
      </div>
    </aside>
  );
}

// --- SidebarTabs Component --- (Keep as is for now)

function SidebarTabs({ isWalletConnected, walletAddress }: { isWalletConnected: boolean, walletAddress: string | null }) { // Accept address prop
  const [activeTab, setActiveTab] = useState('assets');

  return (
    <div className="space-y-6">
      <div className="flex border-b-2 border-black mb-4">
        <TabButton name="assets" activeTab={activeTab} setActiveTab={setActiveTab}>
          <Wallet className="mr-2 h-4 w-4" /> Assets
        </TabButton>
        <TabButton name="activity" activeTab={activeTab} setActiveTab={setActiveTab}>
          <Activity className="mr-2 h-4 w-4" /> Activity
        </TabButton>
      </div>

      {activeTab === 'assets' ? (
        <AssetsSection isWalletConnected={isWalletConnected} walletAddress={walletAddress} /> // Pass address down
      ) : (
        <ActivitySection />
      )}
    </div>
  );
}

interface TabButtonProps {
  name: string;
  activeTab: string;
  setActiveTab: (name: string) => void;
  children: React.ReactNode;
}

function TabButton({ name, activeTab, setActiveTab, children }: TabButtonProps) {
  const isActive = name === activeTab;
  return (
    <Button
      variant="ghost"
      className={`flex-1 justify-center rounded-none font-bold text-sm h-10 relative after:content-[''] after:absolute after:bottom-[-2px] after:left-0 after:right-0 after:h-1 ${isActive ? 'after:bg-black' : 'text-muted-foreground hover:bg-yellow/10'}`}
      onClick={() => setActiveTab(name)}
    >
      {children}
    </Button>
  );
}

// --- AssetsSection ---
import { type DisplayBalance } from './token-list'; // Import the type

function AssetsSection({ isWalletConnected, walletAddress }: { isWalletConnected: boolean, walletAddress: string | null }) { // Accept address prop
  // Add state for tokens and loading
  const [tokens, setTokens] = useState<DisplayBalance[]>([]); 
  const [isLoading, setIsLoading] = useState(false); // Start not loading
  const [error, setError] = useState<string | null>(null); // Add error state

  // Fetch data when the wallet is connected and address is available
  useEffect(() => {
    if (isWalletConnected && walletAddress) {
      const fetchAllBalances = async () => {
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
        <TokenList tokens={tokens} isLoading={isLoading} /> 
        {/* Display error message if fetch fails */}
        {error && <p className="text-sm text-red-600 text-center mt-2">Error: {error}</p>}
        {isWalletConnected && !isLoading && tokens.length > 0 && ( // Conditionally render the button, only if connected, not loading, and has tokens
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start mt-4 border-2 border-black hover:bg-yellow/20 active:translate-y-1 active:shadow-none transition-all duration-100 rounded-xl font-bold"
            style={{ boxShadow: "4px 4px 0px 0px #000000" }}
          >
            <span>Show More</span>
            <ChevronDown className="ml-auto h-4 w-4" />
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
