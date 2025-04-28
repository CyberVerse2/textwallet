'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePrivy } from '@privy-io/react-auth'; // Import usePrivy
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TokenList from './token-list';
import ActivityList from './activity-list';
import {
  Wallet,
  Activity,
  Settings,
  LogOut,
  ChevronDown,
  ChevronUp,
  BarChart2,
  ImageIcon
} from 'lucide-react';

import type { NativeBalance } from './api/native-balances/route'; // Import NativeBalance type
import type { DisplayBalance, EnrichedTokenBalance } from './token-list';
import { isNativeBalance } from './token-list';

interface SidebarTabsProps {
  // Define any props if SidebarTabs receives them
}

export default function Sidebar() {
  return (
    <div className="w-80 flex flex-col">
      <div
        className="bg-white rounded-2xl overflow-hidden flex flex-col h-full"
        style={{ boxShadow: '8px 8px 0px 0px #000000' }}
      >
        <div className="p-6 border-b">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-full bg-yellow flex items-center justify-center text-2xl font-bold"
              style={{ boxShadow: '3px 3px 0px 0px #000000' }}
            >
              *
            </div>
            <span className="font-bold text-xl">Text Wallet</span>
          </div>
        </div>

        <SidebarTabs />
      </div>
    </div>
  );
}

function SidebarTabs({}: SidebarTabsProps) {
  const [activeTab, setActiveTab] = useState('assets');
  const [erc20TokenData, setErc20TokenData] = useState<EnrichedTokenBalance[]>([]);
  const [nativeTokenData, setNativeTokenData] = useState<NativeBalance[]>([]);
  const [totalValue, setTotalValue] = useState<number | null>(null);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showAllTokens, setShowAllTokens] = useState(false);

  // Get user and wallet info from Privy
  const { user, authenticated } = usePrivy();
  // Use optional chaining and memoization for stability
  const walletAddress = useMemo(() => user?.wallet?.address, [user?.wallet?.address]);

  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates on unmounted component
    if (walletAddress) { // Use walletAddress from Privy
      console.log('Fetching tokens for wallet:', walletAddress);
      setIsLoadingTokens(true);
      setFetchError(null);
      setErc20TokenData([]); // Clear previous ERC20 data
      setNativeTokenData([]); // Clear previous Native data

      // Fetch data when address changes
      const fetchData = async () => {
        // Only fetch if address is defined
        if (!walletAddress) {
          console.log('Address not available yet, skipping fetch.');
          setErc20TokenData([]); // Clear balances if address becomes undefined
          setNativeTokenData([]); // Clear balances if address becomes undefined
          setIsLoadingTokens(false);
          return;
        }

        // Fetch ERC20 tokens
        const fetchErc20 = fetch(`/api/tokens?address=${walletAddress}`).then(async (res) => {
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({})); // Try to parse error JSON
            throw new Error(
              `ERC20 Fetch Error: ${res.status} ${res.statusText} - ${
                errorData.error || 'Unknown error'
              }`
            );
          }
          return res.json();
        });

        // Fetch Native ETH balances
        const fetchNative = fetch(`/api/native-balances?address=${walletAddress}`).then(async (res) => {
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({})); // Try to parse error JSON
            throw new Error(
              `Native Fetch Error: ${res.status} ${res.statusText} - ${
                errorData.error || 'Unknown error'
              }`
            );
          }
          return res.json();
        });

        Promise.all([fetchErc20, fetchNative])
          .then(([erc20Result, nativeResult]) => {
            if (!isMounted) return; // Don't update state if component unmounted
            console.log('Fetched ERC20:', erc20Result);
            console.log('Received Native Balances Data:', nativeResult); // Log received native data
            setErc20TokenData(erc20Result.tokens || []);
            const nativeBalances = nativeResult || [];
            setNativeTokenData(nativeBalances); // nativeResult should be the array directly

            // Calculate total value including both ERC20 and Native balances
            const erc20Value = (erc20Result.tokens || []).reduce(
              (sum: number, token: EnrichedTokenBalance) => {
                return sum + (token.usdValue || 0);
              },
              0
            );

            const nativeValue = nativeBalances.reduce((sum: number, balance: NativeBalance) => {
              return sum + (balance.usdValue || 0); // Add native USD value
            }, 0);

            const totalCalculatedValue = erc20Value + nativeValue;
            setTotalValue(totalCalculatedValue);
          })
          .catch((error) => {
            if (!isMounted) return;
            console.error('Failed to fetch balances:', error);
            setFetchError(error.message || 'Failed to load token balances.');
            setTotalValue(null); // Reset total value on error
          })
          .finally(() => {
            if (isMounted) {
              setIsLoadingTokens(false);
            }
          });
      };
      fetchData();
    } else {
      // Clear data if no account
      setErc20TokenData([]);
      setNativeTokenData([]);
      setTotalValue(null);
      setIsLoadingTokens(false);
      setFetchError(null);
    }

    return () => {
      isMounted = false; // Cleanup function to set flag on unmount
    };
  }, [walletAddress]);

  // Combine and sort all balances for display
  const allBalances = useMemo(() => {
    const combined = [...nativeTokenData, ...erc20TokenData] as DisplayBalance[]; // Add type assertion

    // Sort combined list purely by USD value (descending)
    combined.sort((a: DisplayBalance, b: DisplayBalance) => {
      // Get USD values, treating null/undefined as -Infinity for sorting
      const valueA = a.usdValue ?? -Infinity;
      const valueB = b.usdValue ?? -Infinity;

      // Sort primarily by USD value descending
      if (valueB !== valueA) {
        return valueB - valueA;
      }

      // Fallback sorting: Native ETH first, then by symbol
      if (isNativeBalance(a) && !isNativeBalance(b)) return -1;
      if (!isNativeBalance(a) && isNativeBalance(b)) return 1;
      return (a.symbol || '').localeCompare(b.symbol || ''); // Sort by symbol ascending if values equal
    });
    return combined;
  }, [nativeTokenData, erc20TokenData]);

  // Determine which tokens to display based on the 'showAllTokens' state
  const displayTokens = useMemo(() => {
    return showAllTokens ? allBalances : allBalances.slice(0, 3);
  }, [allBalances, showAllTokens]);

  // Determine if the 'Show More' button should be visible
  const canShowMore = useMemo(() => {
    return allBalances.length > 3;
  }, [allBalances.length]);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        setIsLoadingTokens(true);
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts'
        });
        setIsLoadingTokens(false);
      } catch (error: any) {
        console.error('User denied account access', error);
        setIsLoadingTokens(false);
      }
    } else {
      alert('No Ethereum provider found. Install MetaMask.');
    }
  };

  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const disconnectWallet = () => {
    // Optional: Add any other cleanup logic if needed, e.g., clearing local storage
  };

  return (
    <>
      {/* New container for tab buttons with desired styling */}
      <div
        className="bg-muted rounded-xl p-1 mb-6 border-2 border-black flex space-x-1"
        style={{ boxShadow: '4px 4px 0px 0px #000000' }}
      >
        {/* Assets Button */}
        <button
          className={`flex-1 py-2 px-3 rounded-lg font-bold text-center transition-all duration-150 flex items-center justify-center gap-2 ${
            activeTab === 'assets'
              ? 'bg-yellow text-black shadow-inner-sm' // Active state
              : 'text-muted-foreground hover:bg-black/5 active:bg-black/10' // Inactive state
          }`}
          onClick={() => setActiveTab('assets')}
        >
          <Wallet className="h-5 w-5" />
          <span>Assets</span>
        </button>

        {/* Activity Button */}
        <button
          className={`flex-1 py-2 px-3 rounded-lg font-bold text-center transition-all duration-150 flex items-center justify-center gap-2 ${
            activeTab === 'activity'
              ? 'bg-yellow text-black shadow-inner-sm' // Active state
              : 'text-muted-foreground hover:bg-black/5 active:bg-black/10' // Inactive state
          }`}
          onClick={() => setActiveTab('activity')}
        >
          <Activity className="h-5 w-5" />
          <span>Activity</span>
        </button>
      </div>

      <div className="flex-1">
        <div className="p-6">
          {/* Wallet Connection Section */}
          {walletAddress ? (
            <div
              className="bg-muted rounded-xl p-4 mb-6 border-2 border-black"
              style={{ boxShadow: '4px 4px 0px 0px #000000' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">Connected Wallet</span>
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
              </div>
              <div className="text-sm text-muted-foreground truncate">{formatAddress(walletAddress)}</div>
            </div>
          ) : (
            <div className="flex flex-col items-center p-4 mb-6 rounded-xl border-2 border-dashed border-muted-foreground text-center">
              <Wallet className="h-8 w-8 mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">
                Connect your wallet to view assets and activity.
              </p>
              <Button
                onClick={connectWallet}
                disabled={isLoadingTokens}
                variant="outline"
                size="sm"
                className="gap-2 rounded-lg border-2 border-black bg-yellow text-black hover:bg-yellow-dark active:translate-y-px active:shadow-none transition-all duration-100 font-bold"
                style={{ boxShadow: '2px 2px 0px 0px #000000' }}
              >
                <Power className="h-4 w-4" />
                {isLoadingTokens ? 'Connecting...' : 'Connect Wallet'}
              </Button>
            </div>
          )}

          {/* Tab Content */}
          {activeTab === 'assets' ? (
            <div className="flex flex-col h-full">
              {/* Assets Section Header */}
              <div className="mb-6">
                <h3 className="font-bold text-2xl mb-4">Assets</h3>
                
                {/* ETH Token Card */}
                {nativeTokenData.length > 0 ? (
                  <div className="mb-4">
                    <div className="flex items-center justify-between p-4 rounded-xl border-2 border-black mb-3"
                      style={{ boxShadow: "4px 4px 0px 0px #000000" }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                          <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center">
                            <div className="w-4 h-1 bg-blue-500"></div>
                          </div>
                        </div>
                        <div>
                          <div className="font-bold">ETH <span className="text-gray-500 font-normal">(Base)</span></div>
                          <div className="text-gray-500 text-sm">Native Balance</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{parseFloat(nativeTokenData[0]?.formattedBalance || '0').toFixed(3)}</div>
                        <div className="text-gray-500 text-sm">${parseFloat(nativeTokenData[0]?.usdValue?.toFixed(2) || '0')}</div>
                      </div>
                    </div>
                  </div>
                ) : isLoadingTokens ? (
                  <div className="mb-4">
                    <div className="flex items-center justify-between p-4 rounded-xl border-2 border-black mb-3 animate-pulse"
                      style={{ boxShadow: "4px 4px 0px 0px #000000" }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200"></div>
                        <div>
                          <div className="h-4 w-24 bg-gray-200 rounded mb-2"></div>
                          <div className="h-3 w-20 bg-gray-200 rounded"></div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="h-4 w-16 bg-gray-200 rounded mb-2"></div>
                        <div className="h-3 w-12 bg-gray-200 rounded"></div>
                      </div>
                    </div>
                  </div>
                ) : null}
                
                {/* Show Small Balances Button */}
                <button
                  onClick={() => setShowAllTokens(!showAllTokens)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-black bg-yellow text-black font-bold"
                  style={{ boxShadow: "4px 4px 0px 0px #000000" }}
                >
                  <span>Show Small Balances</span>
                  <ChevronDown className="h-5 w-5" />
                </button>
              </div>
              
              {/* Separator Line */}
              <div className="border-b-2 border-black mb-6"></div>
              
              {/* NFTs Section */}
              <button
                className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-black text-black font-bold"
                style={{ boxShadow: "4px 4px 0px 0px #000000" }}
              >
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  <span>NFTs</span>
                </div>
                <ChevronDown className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div>
              {/* Activity Section */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Recent Activity</h3>

                <Activity className="h-4 w-4" />
              </div>
              <ActivityList />
            </div>
          )}

          {/* Settings & Disconnect */}
          <div className="pt-6 border-t-2 border-black mt-6">
            <Button
              variant="outline"
              className="w-full justify-start mb-2 border-2 border-black hover:bg-yellow/20 active:translate-y-px active:shadow-none transition-all duration-100 rounded-xl font-bold"
              style={{ boxShadow: '3px 3px 0px 0px #000000' }}
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </Button>
            {walletAddress && (
              <Button
                variant="outline"
                onClick={disconnectWallet} // onClick handler remains
                className="w-full justify-start text-red-500 border-2 border-red-500 hover:bg-red-50 active:translate-y-px active:shadow-none transition-all duration-100 rounded-xl font-bold"
                style={{ boxShadow: '3px 3px 0px 0px #000000' }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Disconnect</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
