'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { Toaster } from '@/components/ui/toaster';
import { ChatProvider } from '@/context/ChatContext';
import { SupabaseAuthSyncProvider } from '@/components/supabase-auth-sync';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { wagmiConfig } from '@/lib/wagmi';
import { base } from 'wagmi/chains';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const onchainkitApiKey = process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY;

  if (!privyAppId) {
    // Handle the case where the Privy App ID is missing
    // You could render an error message or a fallback UI
    console.error(
      'Privy App ID is not configured. Please set NEXT_PUBLIC_PRIVY_APP_ID in your environment variables.'
    );
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
        Privy App ID is missing. Please configure it in your environment variables.
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <OnchainKitProvider apiKey={onchainkitApiKey} chain={base}>
          <PrivyProvider
            appId={privyAppId}
            config={{
              loginMethods: ['email', 'wallet', 'google', 'discord'],
              appearance: {
                theme: 'light',
                accentColor: '#000000',
                logo: '/placeholder-logo.png'
              },
              embeddedWallets: {
                createOnLogin: 'users-without-wallets'
              }
            }}
          >
            <SupabaseAuthSyncProvider>
              <ChatProvider>
                <Toaster />
                {children}
              </ChatProvider>
            </SupabaseAuthSyncProvider>
          </PrivyProvider>
        </OnchainKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
