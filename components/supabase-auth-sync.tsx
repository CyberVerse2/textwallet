'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from "@/components/ui/use-toast";

export function SupabaseAuthSyncProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, user } = usePrivy();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [serverWalletAddress, setServerWalletAddress] = useState<string | null>(null);

  // Handle user authentication and Supabase sync
  useEffect(() => {
    if (!ready) return;

    const syncUserWithSupabase = async () => {
      if (!authenticated || !user) {
        // User is logged out, clear state
        setServerWalletAddress(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        console.log('🔄 Syncing Privy user with Supabase:', user.id);
        
        // Create or update user in Supabase with upsert
        const { error: upsertError } = await supabase
          .from('users')
          .upsert(
            {
              privy_user_id: user.id,
              email: user.email?.address || null,
              last_login: new Date().toISOString(),
            },
            { 
              onConflict: 'privy_user_id',
              ignoreDuplicates: false // Update the last login timestamp
            }
          );
          
        if (upsertError) {
          console.error('❌ Error syncing user with Supabase:', upsertError);
          toast({
            title: "Authentication Error",
            description: "Failed to sync your account. Please refresh and try again.",
            variant: "destructive"
          });
          setIsLoading(false);
          return;
        }
            
        // Now ensure they have a server wallet
        await ensureServerWallet(user.id);
        
        // Mark initialization as complete
        setIsInitialized(true);
      } catch (err) {
        console.error('❌ Error in auth sync:', err);
        toast({
          title: "Authentication Error",
          description: "Failed to complete setup. Please refresh and try again.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    syncUserWithSupabase();
  }, [ready, authenticated, user, toast]);

  // Fetch or create a server wallet for the user
  const ensureServerWallet = async (privyUserId: string) => {
    try {
      console.log('🔑 Ensuring server wallet for user:', privyUserId);
      
      // First check if user already has a server wallet
      const { data: walletData, error: walletError } = await supabase
        .from('server_wallets')
        .select('*')
        .eq('user_id', privyUserId)
        .eq('is_active', true)
        .single();

      if (walletError || !walletData) {
        console.log('🆕 Creating new server wallet');
        // User doesn't have a server wallet, create one
        const response = await fetch('/api/create-server-wallet', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: privyUserId }),
        });

        if (!response.ok) {
          throw new Error('Failed to create server wallet');
        }

        const { address } = await response.json();
        console.log(`✅ Server wallet created: ${address}`);
        setServerWalletAddress(address);
        
        toast({
          title: "Wallet Setup Complete",
          description: "Your personal server wallet is ready for AI interactions",
        });
      } else {
        console.log(`✅ Using existing server wallet: ${walletData.address}`);
        // User already has a server wallet
        setServerWalletAddress(walletData.address);
      }
    } catch (err) {
      console.error('❌ Error ensuring server wallet:', err);
      toast({
        title: "Wallet Error",
        description: "Could not set up your AI wallet. Some features may be limited.",
        variant: "destructive"
      });
    }
  };

  // Just render children, this component only handles auth sync
  return <>{children}</>;
}
