'use client';
import { Toaster } from '@/components/ui/toaster';
import { ChatProvider } from '@/context/ChatContext';
import { SupabaseAuthSyncProvider } from '@/components/supabase-auth-sync';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { getConfig, wagmiConfig } from '@/lib/wagmi';
import { baseSepolia } from 'wagmi/chains';
import { useState } from 'react';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const [config] = useState(() => getConfig());
  const onchainkitApiKey = process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY;

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <OnchainKitProvider apiKey={onchainkitApiKey} chain={baseSepolia}>
          <SupabaseAuthSyncProvider>
            <ChatProvider>
              <Toaster />
              {children}
            </ChatProvider>
          </SupabaseAuthSyncProvider>
        </OnchainKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
