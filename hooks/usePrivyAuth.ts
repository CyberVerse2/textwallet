import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export const usePrivyAuth = () => {
  const { 
    ready, 
    authenticated, 
    user, 
    login, 
    logout,
    createWallet 
  } = usePrivy();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [serverWalletAddress, setServerWalletAddress] = useState<string | null>(null);

  // Handle user authentication and Supabase sync
  useEffect(() => {
    if (!ready) return;

    const syncUser = async () => {
      setIsLoading(true);
      try {
        if (authenticated && user) {
          // User is authenticated with Privy, sync with Supabase
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('privy_user_id', user.id)
            .single();

          if (error || !data) {
            // User doesn't exist in Supabase, create new user
            await supabase.from('users').insert({
              privy_user_id: user.id,
              email: user.email?.address || null,
              last_login: new Date().toISOString(),
            });
            
            // Create or get server wallet for the user
            await ensureServerWallet(user.id);
          } else {
            // Update last login
            await supabase
              .from('users')
              .update({ last_login: new Date().toISOString() })
              .eq('privy_user_id', user.id);
              
            // Make sure they have a server wallet
            await ensureServerWallet(user.id);
          }
        }
      } catch (err) {
        console.error('Error syncing user:', err);
      } finally {
        setIsLoading(false);
      }
    };

    syncUser();
  }, [ready, authenticated, user]);

  // Fetch or create a server wallet for the user
  const ensureServerWallet = async (privyUserId: string) => {
    try {
      // First check if user already has a server wallet
      const { data: walletData, error: walletError } = await supabase
        .from('server_wallets')
        .select('*')
        .eq('user_id', privyUserId)
        .eq('is_active', true)
        .single();

      if (walletError || !walletData) {
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
        setServerWalletAddress(address);
      } else {
        // User already has a server wallet
        setServerWalletAddress(walletData.address);
      }
    } catch (err) {
      console.error('Error ensuring server wallet:', err);
    }
  };

  return {
    ready,
    authenticated,
    user,
    login,
    logout,
    createWallet,
    isLoading,
    serverWalletAddress,
  };
};
