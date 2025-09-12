'use client';
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
  const onchainkitApiKey = process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY;

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <OnchainKitProvider apiKey={onchainkitApiKey} chain={base}>
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
