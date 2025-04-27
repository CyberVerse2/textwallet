import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useToast } from '@/components/ui/use-toast';
// Keep the client-side supabase for other potential uses (like RLS-protected reads)
import { supabase } from '@/lib/supabaseClient';
// Import ensureServerWallet - adjust path if needed
import { ensureServerWallet } from '@/lib/server-wallet';

interface AuthContextType {
  isInitialized: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const SupabaseAuthSyncProvider = ({ children }: { children: ReactNode }) => {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start loading until ready/auth state is known
  const { toast } = useToast();

  useEffect(() => {
    // Wait for Privy to be ready
    if (!ready) {
      setIsLoading(true);
      return;
    }

    // If ready but not authenticated, or no user object, we are done loading
    if (!authenticated || !user) {
        setIsLoading(false);
        setIsInitialized(true); // Consider initialized if definitely not logged in
        return;
    }

    // Define the async function to sync and setup user
    const syncAndSetupUser = async () => {
      // Prevent starting sync if already loading or initialized
      if (isLoading || isInitialized) return;

      setIsLoading(true);
      console.log('[AuthSync] Privy authenticated, user:', user.id);
      console.log('[AuthSync] Attempting backend sync...');

      try {
        // 1. Get Privy access token
        const authToken = await getAccessToken();
        if (!authToken) {
          throw new Error('Could not retrieve Privy access token.');
        }
        console.log('[AuthSync] Retrieved Privy token.');

        // 2. Call the backend API route to sync the user
        const response = await fetch('/api/sync-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
        });

        const result = await response.json();

        if (!response.ok) {
          console.error('❌ Error syncing user via backend:', result);
          throw new Error(result.message || 'Failed to sync user via backend.');
        }

        console.log('[AuthSync] Backend sync successful:', result.message, 'User ID:', result.userId);

        // 3. Ensure server wallet exists (after successful sync)
        // Pass the client-side supabase instance if ensureServerWallet needs it for RLS checks
        await ensureServerWallet(user.id, supabase);

        setIsInitialized(true);
        console.log('[AuthSync] User sync and setup complete.');

      } catch (err: any) {
        console.error('❌ Error during auth sync process:', err);
        toast({
          title: 'Authentication Setup Error',
          description: err.message || 'Failed to complete setup. Please refresh and try again.',
          variant: 'destructive',
        });
        // Keep loading false, but maybe set initialized false if setup is critical?
        // For now, let's assume partial success might be okay, or user needs to refresh.
        setIsInitialized(false); // Indicate setup didn't fully complete
      } finally {
        setIsLoading(false);
      }
    };

    // Trigger the sync only if authenticated and not already initialized/loading
    syncAndSetupUser();

    // Dependencies: Run when auth state changes or essential functions become available
  }, [ready, authenticated, user, getAccessToken, toast, isInitialized, isLoading]);

  return (
    <AuthContext.Provider value={{ isInitialized, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
