'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAccount, useDisconnect, useConnect } from 'wagmi';
import { SignInWithBaseButton } from '@base-org/account-ui/react';
import { signInWithBase } from '@/lib/baseAuth';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TokenList from './token-list';
import ActivityList from './activity-list';
import {
  Wallet as WalletIcon,
  Activity,
  Settings,
  LogOut,
  ChevronDown,
  ChevronUp,
  BarChart2,
  ImageIcon
} from 'lucide-react';
// Using Wagmi connect to implement a custom-styled connect button

import type { NativeBalance } from './api/native-balances/route'; // Import NativeBalance type
import type { DisplayBalance, EnrichedTokenBalance } from './token-list';
import { isNativeBalance } from './token-list';

interface SidebarTabsProps {
  // Define any props if SidebarTabs receives them
}

export default function Sidebar() {
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  return (
    <div className="w-80 flex flex-col">
      <div
        className="bg-white rounded-2xl flex flex-col h-full"
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
            <span className="font-bold text-xl">PolyAgent</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <SidebarTabs />
        </div>

        <div className="p-6 border-t-2 border-black">
          {isConnected ? (
            <Button
              variant="outline"
              className="w-full justify-start mb-2 border-2 border-black hover:bg-blue/20 active:translate-y-px active:shadow-none transition-all duration-100 rounded-xl font-bold"
              style={{ boxShadow: '3px 3px 0px 0px #000000' }}
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </Button>
          ) : (
            <div className="w-full mb-2">
              <SignInWithBaseButton
                colorScheme="light"
                onClick={async () => {
                  await signInWithBase();
                }}
              />
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => disconnect()}
            className="w-full justify-start text-red-500 border-0 hover:bg-red-50 active:translate-y-px active:shadow-none transition-all duration-100 rounded-xl font-bold"
            style={{ boxShadow: '3px 3px 0px 0px #dc2626' }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log Out</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function SidebarTabs({}: SidebarTabsProps) {
  const [activeTab, setActiveTab] = useState('positions');
  const [erc20TokenData, setErc20TokenData] = useState<EnrichedTokenBalance[]>([]);
  const [nativeTokenData, setNativeTokenData] = useState<NativeBalance[]>([]);
  const [totalValue, setTotalValue] = useState<number | null>(null);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showAllTokens, setShowAllTokens] = useState(false);

  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connectors, connect, isPending } = useConnect();
  // Use optional chaining and memoization for stability
  const walletAddress = useMemo(
    () => (isConnected ? address ?? null : null),
    [address, isConnected]
  );

  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates on unmounted component

    if (walletAddress) {
      // Use walletAddress from Privy
      setIsLoadingTokens(true);
      setFetchError(null);
      setErc20TokenData([]); // Clear previous ERC20 data
      setNativeTokenData([]); // Clear previous Native data

      // Fetch data when address changes
      const fetchData = async () => {
        // Only fetch if address is defined
        if (!walletAddress) {
          setErc20TokenData([]); // Clear balances if address becomes undefined
          setNativeTokenData([]); // Clear balances if address becomes undefined
          setTotalValue(null);
          setIsLoadingTokens(false);
          setFetchError(null);
          return;
        }

        const erc20Url = `/api/tokens?address=${walletAddress}`;
        const nativeUrl = `/api/native-balances?address=${walletAddress}`;

        // Fetch ERC20 tokens
        const fetchErc20 = fetch(erc20Url).then(async (res) => {
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({})); // Try to parse error JSON
            throw new Error(
              `ERC20 API Error ${res.status}: ${res.statusText} - ${
                errorData?.message || 'Unknown error'
              }`
            );
          }
          const data = await res.json();
          return data;
        });

        // Fetch Native ETH balances
        const fetchNative = fetch(nativeUrl).then(async (res) => {
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({})); // Try to parse error JSON
            throw new Error(
              `Native Balances API Error ${res.status}: ${res.statusText} - ${
                errorData?.message || 'Unknown error'
              }`
            );
          }
          const data = await res.json();
          return data;
        });

        try {
          const [erc20Result, nativeResult] = await Promise.allSettled([fetchErc20, fetchNative]);

          if (!isMounted) return; // Don't update state if component unmounted

          let combinedValue = 0;
          let currentError = null;

          if (erc20Result.status === 'fulfilled') {
            const processedTokens = erc20Result.value.tokens || [];
            setErc20TokenData(processedTokens);

            combinedValue += (erc20Result.value.tokens || []).reduce(
              (sum: number, token: EnrichedTokenBalance) => {
                return sum + (token.usdValue || 0);
              },
              0
            );
          } else if (erc20Result.status === 'rejected') {
            setErc20TokenData([]); // Clear data on error
            currentError = erc20Result.reason?.message || 'Failed to fetch ERC20 tokens';
          }

          if (nativeResult.status === 'fulfilled') {
            const filteredNativeData = nativeResult.value || [];
            setNativeTokenData(filteredNativeData);

            combinedValue += filteredNativeData.reduce((sum: number, balance: NativeBalance) => {
              return sum + (balance.usdValue || 0);
            }, 0);
          } else if (nativeResult.status === 'rejected') {
            setNativeTokenData([]); // Clear data on error
            // Append to existing error or set if no previous error
            currentError = currentError
              ? `${currentError}; ${
                  nativeResult.reason?.message || 'Failed to fetch native balances'
                }`
              : nativeResult.reason?.message || 'Failed to fetch native balances';
          }

          setTotalValue(combinedValue);
          setFetchError(currentError);
        } catch (error: any) {
          setFetchError(error.message || 'An unexpected error occurred while fetching data');
          setErc20TokenData([]); // Clear data on error
          setNativeTokenData([]); // Clear data on error
          setTotalValue(null); // Clear total value on error
        } finally {
          if (isMounted) {
            setIsLoadingTokens(false);
          }
        }
      };
      fetchData();
    } else if (false) {
      // Placeholder branch retained for future auth states if needed
      setErc20TokenData([]);
      setNativeTokenData([]);
      setTotalValue(null);
      setIsLoadingTokens(false);
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

  // Renamed for clarity as it's just for display formatting
  const formatDisplayAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  return (
    <>
      {/* New container for tab buttons with desired styling */}
      <div
        className="bg-muted rounded-xl p-1 mb-6 border-2 border-black flex space-x-1"
        style={{ boxShadow: '4px 4px 0px 0px #000000' }}
      >
        {/* Positions Button */}
        <button
          className={`flex-1 py-2 px-3 rounded-lg font-bold text-center transition-all duration-150 flex items-center justify-center gap-2 ${
            activeTab === 'positions'
              ? 'bg-blue text-black shadow-inner-sm' // Active state
              : 'text-muted-foreground hover:bg-black/5 active:bg-black/10' // Inactive state
          }`}
          onClick={() => setActiveTab('positions')}
        >
          <BarChart2 className="h-5 w-5" />
          <span>Positions</span>
        </button>

        {/* Activity Button */}
        <button
          className={`flex-1 py-2 px-3 rounded-lg font-bold text-center transition-all duration-150 flex items-center justify-center gap-2 ${
            activeTab === 'activity'
              ? 'bg-blue text-black shadow-inner-sm' // Active state
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
          {isConnected ? (
            <div
              className="bg-muted rounded-xl p-4 mb-6 border-2 border-black"
              style={{ boxShadow: '4px 4px 0px 0px #000000' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">Connected Wallet</span>
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
              </div>
              <div className="text-sm text-muted-foreground truncate">
                {formatDisplayAddress(walletAddress || '')}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center p-4 mb-6 rounded-xl border-2 border-dashed border-muted-foreground text-center">
              <WalletIcon className="h-8 w-8 mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">
                Please log in to connect a wallet.
              </p>
            </div>
          )}

          {/* Tab Content */}
          {activeTab === 'positions' ? (
            <div className="flex flex-col h-full">
              {/* Positions Section Header */}
              <div className="mb-6">
                <h3 className="font-bold text-2xl mb-4">Positions</h3>
                <NvidiaPositionCard />
              </div>
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
            {isConnected ? (
              <>
                <Button
                  variant="outline"
                  className="w-full justify-start mb-2 border-2 border-black hover:bg-yellow/20 active:translate-y-px active:shadow-none transition-all duration-100 rounded-xl font-bold"
                  style={{ boxShadow: '3px 3px 0px 0px #000000' }}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => disconnect()}
                  className="w-full justify-start text-red-500 border-2 border-red-500 hover:bg-red-50 active:translate-y-px active:shadow-none transition-all duration-100 rounded-xl font-bold"
                  style={{ boxShadow: '3px 3px 0px 0px #dc2626' }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log Out</span>
                </Button>
              </>
            ) : (
              <div className="w-full">
                <SignInWithBaseButton
                  colorScheme="light"
                  onClick={() => {
                    /* base handles modal */
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function NvidiaPositionCard() {
  const { address } = useAccount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pos, setPos] = useState<{
    title: string;
    url?: string;
    yesSize: number;
    noSize: number;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      if (!address) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/positions?userId=${address}`);
        const json = await res.json();
        if (!isMounted) return;
        const p = Array.isArray(json?.positions) ? json.positions[0] : null;
        setPos(
          p ? { title: p.title, url: p.url, yesSize: p.yesSize || 0, noSize: p.noSize || 0 } : null
        );
      } catch (e: any) {
        if (!isMounted) return;
        setError(e?.message || 'failed');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    run();
    return () => {
      isMounted = false;
    };
  }, [address]);

  if (!address) return null;
  if (loading)
    return (
      <div
        className="p-4 rounded-xl border-2 border-black animate-pulse"
        style={{ boxShadow: '4px 4px 0px 0px #000000' }}
      >
        Loading position…
      </div>
    );
  if (error)
    return (
      <div
        className="p-4 rounded-xl border-2 border-black bg-red-50"
        style={{ boxShadow: '4px 4px 0px 0px #000000' }}
      >
        Failed to load position
      </div>
    );
  if (!pos)
    return (
      <div
        className="p-4 rounded-xl border-2 border-black"
        style={{ boxShadow: '4px 4px 0px 0px #000000' }}
      >
        No NVIDIA position yet.
      </div>
    );

  return (
    <div
      className="p-4 rounded-xl border-2 border-black"
      style={{ boxShadow: '4px 4px 0px 0px #000000' }}
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
  );
}
