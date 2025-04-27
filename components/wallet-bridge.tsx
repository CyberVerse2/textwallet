'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConnectedWallet, usePrivy, useWallets } from '@privy-io/react-auth';
import { useToast } from "@/components/ui/use-toast";
import { formatEther, parseEther } from 'ethers';
import { shortenAddress } from '@/lib/utils';
import { Loader2, RefreshCw, Wallet, Activity, ChevronDown, ImageIcon } from 'lucide-react';

export default function WalletBridge() {
  const { toast } = useToast();
  const { ready, authenticated, user, logout } = usePrivy();
  const { wallets } = useWallets();
  const [embeddedWalletAddress, setEmbeddedWalletAddress] = useState<string | null>(null);
  const [embeddedWallet, setEmbeddedWallet] = useState<ConnectedWallet | null>(null);
  const [embeddedBalance, setEmbeddedBalance] = useState<string>('0');
  const [serverWalletAddress, setServerWalletAddress] = useState<string | null>(null);
  const [serverBalance, setServerBalance] = useState<string>('0');
  const [amount, setAmount] = useState<string>('0.01');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isFunding, setIsFunding] = useState<boolean>(false);
  const [showSmallBalances, setShowSmallBalances] = useState<boolean>(false);

  useEffect(() => {
    if (ready && authenticated) {
      const embedded = wallets.find((wallet: ConnectedWallet) => wallet.walletClientType === 'privy');
      if (embedded && embedded.address) {
        setEmbeddedWallet(embedded);
        setEmbeddedWalletAddress(embedded.address);
        fetchServerWalletAddress();
      } else {
        setIsLoading(false);
      }
    }
  }, [ready, authenticated, wallets]);

  // Fetch server wallet address
  const fetchServerWalletAddress = async () => {
    setIsFetching(true);
    try {
      // Get user ID from embedded wallet
      if (!embeddedWallet?.address) {
        throw new Error('Embedded wallet not connected');
      }
      
      // Use the wallet address as the user identifier if no other ID is available
      // This works as a fallback in case we can't get the Privy user ID
      const userId = embeddedWallet.address;
      
      // Fetch server wallet address for this specific user
      const response = await fetch(`/api/server-wallet-address?userId=${userId}`, {
        method: 'GET',
      });
      
      const data = await response.json();
      if (data.address) {
        setServerWalletAddress(data.address);
      } else {
        toast({
          title: "Error",
          description: "Could not fetch server wallet address",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error fetching server wallet address:", error);
      toast({
        title: "Error",
        description: "Could not fetch server wallet address",
        variant: "destructive"
      });
    } finally {
      setIsFetching(false);
      setIsLoading(false);
    }
  };

  // Fetch balances for both wallets
  useEffect(() => {
    if (embeddedWalletAddress && serverWalletAddress) {
      fetchBalances();
    }
  }, [embeddedWalletAddress, serverWalletAddress]);

  // Fetch balances
  const fetchBalances = async () => {
    try {
      // Fetch both balances in parallel
      if (embeddedWalletAddress && serverWalletAddress) {
        const [embeddedResponse, serverResponse] = await Promise.all([
          fetch(`/api/balance?address=${embeddedWalletAddress}`),
          fetch(`/api/balance?address=${serverWalletAddress}`)
        ]);

        const embeddedData = await embeddedResponse.json();
        const serverData = await serverResponse.json();

        if (embeddedData.balance) {
          setEmbeddedBalance(embeddedData.balance);
        }
        
        if (serverData.balance) {
          setServerBalance(serverData.balance);
        }
      }
    } catch (error) {
      console.error("Error fetching balances:", error);
    }
  };

  // Fund server wallet from embedded wallet
  const fundServerWallet = async () => {
    if (!embeddedWallet || !serverWalletAddress) {
      toast({
        title: "Error",
        description: "Missing wallet information",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsFunding(true);
      
      // Parse amount to Wei (ETH to wei conversion)
      const amountInWei = parseEther(amount);
      
      // Request transaction through our API
      const response = await fetch('/api/request-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromAddress: embeddedWalletAddress,
          toAddress: serverWalletAddress,
          amount: amountInWei.toString(),
        }),
      });

      const data = await response.json();
      
      // If we have a transaction hash back, it was successful
      if (data.hash) {
        toast({
          title: "Success!",
          description: `Funded server wallet with ${amount} ETH`,
        });
        
        // Refresh balances after a short delay to allow the transaction to be processed
        setTimeout(() => {
          fetchBalances();
        }, 3000);
      } else {
        throw new Error(data.error || "Transaction failed");
      }
    } catch (error) {
      console.error("Error funding server wallet:", error);
      toast({
        title: "Transaction Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    } finally {
      setIsFunding(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-yellow" />
            <p className="text-lg font-semibold mt-4">Loading wallet information...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render the wallet info UI with Assets and Activity tabs
  return (
    <Card className="w-full">
      <CardHeader className="pb-0">
        <CardTitle>My Wallet</CardTitle>
        <CardDescription>
          Your AI-enabled blockchain wallet
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-0">
        <Tabs defaultValue="assets" className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-2">
            <TabsTrigger value="assets" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Assets
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Activity
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="assets" className="px-6 py-2">
            <h3 className="text-xl font-bold mb-4">Assets</h3>
            
            <div className="flex justify-between items-center mb-2">
              <div className="flex-1"></div>
              <Button variant="outline" size="icon" className="rounded-full">
                <RefreshCw className="h-4 w-4" onClick={fetchBalances} />
              </Button>
            </div>
            
            <div className="border-2 border-black rounded-xl p-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                  <span className="text-white font-bold">E</span>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <div>
                      <span className="font-bold text-lg">ETH</span>{" "}
                      <span className="text-gray-500">(Base)</span>
                    </div>
                    <div className="font-bold text-lg">
                      {parseFloat(formatEther(BigInt(serverBalance || '0'))).toFixed(3)}
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Native Balance</span>
                    <span className="text-gray-500">
                      ${(parseFloat(formatEther(BigInt(serverBalance || '0'))) * 1630).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              className="w-full mb-4 border-2 border-yellow bg-yellow rounded-xl flex items-center justify-between"
              onClick={() => setShowSmallBalances(!showSmallBalances)}
            >
              <span className="font-bold">Show Small Balances</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
            
            <div className="border-t border-gray-200 my-4"></div>
            
            <Button 
              variant="outline" 
              className="w-full mb-2 border-2 border-yellow bg-yellow rounded-xl flex items-center justify-between"
              onClick={() => {}}
            >
              <div className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                <span className="font-bold">NFTs</span>
              </div>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </TabsContent>
          
          <TabsContent value="activity" className="px-6 py-2">
            <h3 className="text-xl font-bold mb-4">Activity</h3>
            
            <div className="text-center text-gray-500 py-6">
              No activity yet
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
