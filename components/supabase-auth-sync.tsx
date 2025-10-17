import { useEffect, useState, createContext, useContext, ReactNode, useRef } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { useToast } from '@/components/ui/use-toast';
// Keep the client-side supabase for other potential uses (like RLS-protected reads)
import { supabase } from '@/lib/supabaseClient';

interface AuthContextType {
  isInitialized: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const SupabaseAuthSyncProvider = ({ children }: { children: ReactNode }) => {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const lastVerifiedFor = useRef<string | null>(null);

  useEffect(() => {
    // If no connected wallet, ensure sync is not marked initialized
    if (!address) {
      setIsLoading(false);
      setIsInitialized(false);
      return;
    }
    // Avoid re-verifying in a loop for the same address
    if (isInitialized && lastVerifiedFor.current === address.toLowerCase()) return;

    // Define the async function to sync and setup user
    const syncAndSetupUser = async () => {
      // Prevent starting sync if already loading
      if (isLoading) return;

      // Client-side cache to avoid repeated signature prompts within a window of time
      try {
        const cachedAddr = localStorage.getItem('tw_verified_addr');
        const cachedUntil = Number(localStorage.getItem('tw_verified_until') || '0');
        if (cachedAddr && cachedAddr === address.toLowerCase() && cachedUntil > Date.now()) {
          lastVerifiedFor.current = address.toLowerCase();
          setIsInitialized(true);
          return;
        }
      } catch {}

      setIsLoading(true);
      console.log('[AuthSync] Wallet connected:', address);
      console.log('[AuthSync] Starting lightweight session sync (no signature)...');

      try {
        // Lightweight session: store address locally without signing
        try {
          localStorage.setItem('tw_address', address.toLowerCase());
        } catch {}

        // 3. Call the backend API route to sync the user by wallet address
        const syncRes = await fetch('/api/sync-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address })
        });
        const syncJson = await syncRes.json();
        if (!syncRes.ok) {
          console.error('❌ Error syncing user via backend:', syncJson);
          throw new Error(syncJson.message || 'Failed to sync user via backend.');
        }
        console.log('[AuthSync] Backend sync successful:', syncJson.message);
        lastVerifiedFor.current = address.toLowerCase();
        setIsInitialized(true);
        console.log('[AuthSync] User sync complete (no signature).');
      } catch (err: any) {
        console.error('❌ Error during auth sync process:', err);
        toast({
          title: 'Authentication Setup Error',
          description: err.message || 'Failed to complete setup. Please refresh and try again.',
          variant: 'destructive'
        });
        // Keep loading false, but maybe set initialized false if setup is critical?
        // For now, let's assume partial success might be okay, or user needs to refresh.
        setIsInitialized(false); // Indicate setup didn't fully complete
      } finally {
        setIsLoading(false);
      }
    };

    // Trigger the sync when address is available
    syncAndSetupUser();

    // Dependencies: Run when auth state changes or essential functions become available
  }, [address, signMessageAsync, toast]);

  return (
    <AuthContext.Provider value={{ isInitialized, isLoading }}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
