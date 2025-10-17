'use client';

import React, {
  useEffect,
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
  useMemo
} from 'react';
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
import { useAccount, useDisconnect, useConnect, useConnections } from 'wagmi';
// Sign in with Base removed; will be reimplemented from scratch
import ReactMarkdown from 'react-markdown';
import { getBaseAccountProvider, verifySubAccountCreated } from '@/lib/baseAccountSdk';

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
  const { isWalletConnected, walletAddress, setIsWalletConnected, setWalletAddress } =
    useChatContext();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const connections = useConnections();

  // State for copy address button
  const [isCopied, setIsCopied] = useState(false);
  // State for funding
  const [isFunding, setIsFunding] = useState(false);
  // USDC balance state
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [subAddress, setSubAddress] = useState<string | null>(null);
  const [universalAddress, setUniversalAddress] = useState<string | null>(null);
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
  const isWalletEffectivelyConnected = isConnected || isWalletConnected;
  const displayAddress = isConnected ? address ?? null : walletAddress;

  // Update context based on Wagmi state
  useEffect(() => {
    setIsWalletConnected(isConnected);
    setWalletAddress(isConnected ? address ?? null : null);
  }, [address, isConnected, setIsWalletConnected, setWalletAddress]);

  // Derive sub and universal addresses from current connections
  useEffect(() => {
    try {
      const flat = connections.flatMap((c) => (c as any).accounts as string[]);
      const [_sub, universal] = flat;
      setSubAddress((_sub as any) ?? address ?? null);
      setUniversalAddress((universal as any) ?? null);
    } catch {
      setSubAddress(address ?? null);
      setUniversalAddress(null);
    }
  }, [connections, address]);

  // Fetch Base USDC balance when address changes
  useEffect(() => {
    let abort = false;
    const fetchUsdc = async () => {
      try {
        if (!displayAddress) {
          setUsdcBalance(null);
          return;
        }
        const res = await fetch(`/api/usdc-balance?address=${displayAddress}`, {
          cache: 'no-store'
        });
        if (!res.ok) throw new Error('usdc_balance_failed');
        const json = await res.json();
        if (abort) return;
        const raw = BigInt(json.balance);
        const decimals = Number(json.decimals ?? 6);
        const formatted = (Number(raw) / 10 ** decimals).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
        setUsdcBalance(`${formatted} USDC`);
      } catch {
        if (!abort) setUsdcBalance(null);
      }
    };
    fetchUsdc();
    return () => {
      abort = true;
    };
  }, [displayAddress]);

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
            {isWalletEffectivelyConnected && subAddress && (
              <div className="text-xs text-muted-foreground truncate" title={subAddress}>
                Sub: {shortenAddress(subAddress)}
              </div>
            )}
            {isWalletEffectivelyConnected && universalAddress && (
              <div className="text-xs text-muted-foreground truncate" title={universalAddress}>
                Universal: {shortenAddress(universalAddress)}
              </div>
            )}
            {isWalletEffectivelyConnected && usdcBalance && (
              <div className="text-xs text-black mt-1">Base USDC: {usdcBalance}</div>
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
            <Button
              variant="outline"
              className="w-full justify-start border-2 border-black rounded-xl font-bold"
              style={{ boxShadow: '4px 4px 0px 0px #000000' }}
              size="sm"
              onClick={async () => {
                try {
                  const provider = getBaseAccountProvider();
                  // Ensure Base Account quickstart flow runs and creates sub account
                  await provider.request({ method: 'wallet_connect', params: [] });
                  await provider.request({ method: 'eth_requestAccounts', params: [] });
                  const verification = await verifySubAccountCreated();
                  if (verification.verified) {
                    setSubAddress(verification.subAccount || null);
                    setUniversalAddress(verification.universalAccount || null);
                  } else {
                    console.warn('Subaccount verification failed', verification.reason);
                  }
                } catch (e) {
                  // Fallback: continue to wagmi connect even if SDK pre-connect fails
                  console.error('Base Account SDK connect failed', e);
                } finally {
                  const baseConnector =
                    connectors.find((c) => (c.name || '').toLowerCase().includes('base')) ??
                    connectors[0];
                  if (baseConnector) connect({ connector: baseConnector });
                }
              }}
            >
              Sign In
            </Button>
          </div>
        )}
        {isWalletEffectivelyConnected && (
          <Button
            variant="outline"
            className="w-full justify-start border-2 border-black hover:bg-yellow/20 active:translate-y-1 active:shadow-none transition-all duration-100 rounded-xl font-bold"
            style={{ boxShadow: '4px 4px 0px 0px #000000' }}
            onClick={async () => {
              try {
                await fetch('/api/auth/logout', { method: 'POST' });
              } catch {}
              disconnect();
              setIsWalletConnected(false);
              setWalletAddress(null);
              setSubAddress(null);
              setUniversalAddress(null);
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log Out</span>
          </Button>
        )}
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
  const [activeTab, setActiveTab] = useState<'positions' | 'activity'>('positions');
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
            activeTab === 'positions'
              ? 'bg-blue text-black border-2 border-black'
              : 'text-black hover:bg-blue/50 active:translate-y-px'
          }`}
          style={activeTab === 'positions' ? { boxShadow: '2px 2px 0px 0px #000000' } : {}}
          onClick={() => setActiveTab('positions')}
        >
          <BarChart2 className="h-4 w-4" /> Positions
        </button>
        <button
          className={`flex-1 py-2 px-4 rounded-lg font-bold transition-all duration-150 flex items-center justify-center gap-2 ${
            activeTab === 'activity'
              ? 'bg-blue text-black border-2 border-black'
              : 'text-black hover:bg-blue/50 active:translate-y-px'
          }`}
          style={activeTab === 'activity' ? { boxShadow: '2px 2px 0px 0px #000000' } : {}}
          onClick={() => setActiveTab('activity')}
        >
          <Activity className="h-4 w-4" /> Activity
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'positions' && (
          <PositionsSection isWalletConnected={isWalletConnected} walletAddress={walletAddress} />
        )}
        {activeTab === 'activity' && (
          <ActivityList walletAddress={walletAddress} refreshTrigger={refreshTrigger} />
        )}
      </div>
    </div>
  );
});

// --- AssetsSection ---
function PositionsSection({
  isWalletConnected,
  walletAddress
}: {
  isWalletConnected: boolean;
  walletAddress: string | null;
}) {
  const [pos, setPos] = useState<{
    title: string;
    url?: string;
    yesSize: number;
    noSize: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!walletAddress) return;
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/positions?userId=${walletAddress}`);
        const json = await res.json();
        const p = Array.isArray(json?.positions) ? json.positions[0] : null;
        setPos(
          p ? { title: p.title, url: p.url, yesSize: p.yesSize || 0, noSize: p.noSize || 0 } : null
        );
      } catch (e: any) {
        setError(e?.message || 'failed');
      } finally {
        setIsLoading(false);
      }
    };
    run();
  }, [walletAddress]);

  // Create a function to fetch all balances that can be called from other components
  const fetchAllBalances = async () => {};

  // Fetch data when the wallet is connected and address is available
  useEffect(() => {
    // positions section no-op here
  }, [isWalletConnected, walletAddress]); // Re-run effect when connection or address changes

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Positions</h3>
        </div>
        {isLoading && (
          <div
            className="p-4 rounded-xl border-2 border-black animate-pulse"
            style={{ boxShadow: '2px 2px 0px 0px #000000' }}
          >
            Loading…
          </div>
        )}
        {!isLoading && error && (
          <div
            className="p-4 rounded-xl border-2 border-black bg-red-50"
            style={{ boxShadow: '2px 2px 0px 0px #000000' }}
          >
            Failed to load position
          </div>
        )}
        {!isLoading && !error && pos && (
          <div
            className="p-4 rounded-xl border-2 border-black"
            style={{ boxShadow: '2px 2px 0px 0px #000000' }}
          >
            <div className="flex items-center justify-between mb-2">
              <a href={pos.url} target="_blank" rel="noreferrer" className="font-bold underline">
                {pos.title}
              </a>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm">YES size</div>
              <div className="font-bold">${pos.yesSize.toFixed(2)}</div>
            </div>
            <div className="flex items-center justify-between mt-1">
              <div className="text-sm">NO size</div>
              <div className="font-bold">${pos.noSize.toFixed(2)}</div>
            </div>
          </div>
        )}
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
