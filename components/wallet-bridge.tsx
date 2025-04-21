'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConnectedWallet, usePrivy, useWallets } from '@privy-io/react-auth';
import { useToast } from "@/components/ui/use-toast";
import { formatEther, parseEther } from 'ethers';
import { shortenAddress } from '@/lib/utils';
import { Loader2, ArrowRight, RefreshCw } from 'lucide-react';

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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Wallet Bridge</CardTitle>
        <CardDescription>
          TextWallet uses a secure server wallet for AI interactions. You need to add funds to your server wallet.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {/* Server Wallet Section - Primary Focus */}
        <div className="mb-8 p-4 border-2 border-black rounded-md">
          <h3 className="text-xl font-bold mb-2">📱 Your AI Server Wallet</h3>
          <p className="text-sm text-gray-600 mb-4">
            This is your dedicated server wallet that the AI will use for all blockchain interactions.
          </p>
          
          {serverWalletAddress ? (
            <>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div>
                  <p className="text-sm font-medium">Address:</p>
                  <p className="text-xs overflow-hidden text-ellipsis">{shortenAddress(serverWalletAddress)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Balance:</p>
                  <p className="font-bold">{parseFloat(formatEther(BigInt(serverBalance || '0'))).toFixed(4)} ETH</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={fetchBalances} 
                disabled={isFetching}
              >
                {isFetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Refresh Balance
              </Button>
            </>
          ) : (
            <p>Server wallet not available</p>
          )}
        </div>
        
        {/* Embedded Wallet Section - Secondary */}
        <div className="mb-4 p-4 border border-black rounded-md bg-white">
          <h3 className="text-lg font-medium mb-2">💼 Funding Source Wallet</h3>
          <p className="text-sm text-gray-600 mb-4">
            This embedded wallet is only used for funding your server wallet.
          </p>
          
          {embeddedWalletAddress ? (
            <>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div>
                  <p className="text-sm font-medium">Address:</p>
                  <p className="text-xs overflow-hidden text-ellipsis">{shortenAddress(embeddedWalletAddress)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Balance:</p>
                  <p>{parseFloat(formatEther(BigInt(embeddedBalance || '0'))).toFixed(4)} ETH</p>
                </div>
              </div>
              
              {/* Fund Server Wallet Section */}
              {serverWalletAddress && (
                <div className="mt-4 p-4 border border-black rounded bg-white">
                  <h4 className="font-medium mb-2">Fund Your AI Server Wallet</h4>
                  <div className="flex gap-2 mb-2">
                    <Input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      onClick={fundServerWallet} 
                      disabled={isFunding || isFetching || parseFloat(formatEther(BigInt(embeddedBalance || '0'))) < parseFloat(amount)}
                    >
                      {isFunding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      {isFunding ? 'Sending...' : 'Send Funds'}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-600">
                    Fund your server wallet to enable AI blockchain interactions
                  </p>
                </div>
              )}
            </>
          ) : (
            <p>Embedded wallet not connected</p>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <p className="text-xs text-gray-600">
          All AI interactions use your server wallet
        </p>
      </CardFooter>
    </Card>
  );
}
