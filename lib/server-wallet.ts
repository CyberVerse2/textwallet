import { supabase } from '@/lib/supabaseClient';
import { Wallet } from 'ethers';
import { SupabaseClient } from '@supabase/supabase-js'; // Import SupabaseClient type

// Core logic for creating a server wallet (likely used by API route)
export async function _createServerWalletLogic(userId: string): Promise<{ address: string } | { error: any, status?: number }> {
  try {
    console.log(`🔑 Creating server wallet for user: ${userId}`);

    // 1. Create a new wallet
    const wallet = Wallet.createRandom();
    const address = wallet.address;
    const privateKey = wallet.privateKey;

    // 3. Insert into the database with the raw private key
    const { error: insertError } = await supabase
      .from('server_wallets')
      .insert({
        user_id: userId,
        address: address,
        // Storing raw private key - BE VERY CAREFUL
        private_key: privateKey, 
        is_active: true, // Ensure new wallets are marked active
      });

    if (insertError) {
      // Handle potential race condition or unique constraint violation
      if (insertError.code === '23505') { // Unique violation code
        console.warn(`Race condition or duplicate wallet creation attempt for user ${userId}`);
        // Attempt to fetch the existing active wallet
        const { data: raceWallet, error: fetchError } = await supabase
          .from('server_wallets')
          .select('address')
          .eq('user_id', userId)
          .eq('is_active', true)
          .single();
          
        if (fetchError) {
          console.error(`Error fetching existing wallet after race condition for user ${userId}:`, fetchError);
          return { error: 'Database error after wallet creation conflict', status: 500 };
        }
        if (raceWallet) {
          console.log(`Returning existing wallet address ${raceWallet.address} after race condition for user ${userId}`);
          return { address: raceWallet.address };
        }
      }
      // If it's not a unique violation or fetch failed, throw the original insert error
      console.error(`Error inserting server wallet for user ${userId}:`, insertError);
      return { error: insertError, status: 500 }; 
    }
    
    console.log(`✅ Successfully created server wallet ${address} for user ${userId}`);
    return { address };

  } catch (error: any) {
    console.error(`Unexpected error creating server wallet for user ${userId}:`, error);
    return { 
      error: 'Failed to create server wallet', 
      status: 500 
    };
  }
}

/**
 * Ensures a server wallet exists for the given user.
 * Checks using the client-side Supabase instance (respects RLS if applicable for reads).
 * Calls the API route to create a wallet if one doesn't exist.
 * Throws an error on failure.
 * @param privyUserId - The user's Privy ID.
 * @param clientSupabase - The client-side Supabase instance.
 */
export async function ensureServerWallet(privyUserId: string, clientSupabase: SupabaseClient): Promise<void> {
  try {
    console.log('🔑 Ensuring server wallet for user:', privyUserId);

    // First check if user already has an active server wallet using the client instance
    const { data: walletData, error: walletError } = await clientSupabase
      .from('server_wallets')
      .select('address') // Only need to know if it exists
      .eq('user_id', privyUserId)
      .eq('is_active', true)
      .maybeSingle(); // Use maybeSingle to handle 0 or 1 result without error

    // Handle potential errors during the check (e.g., network, RLS if applicable)
    if (walletError) {
      console.error('Error checking for existing server wallet:', walletError);
      throw new Error('Failed to check for server wallet.');
    }

    if (walletData) {
      console.log(`✅ User ${privyUserId} already has an active server wallet: ${walletData.address}`);
      return; // Wallet exists, nothing more to do
    }

    // Wallet doesn't exist or check failed, try creating via API
    console.log(`🆕 No active wallet found for ${privyUserId}. Calling API to create one.`);
    const response = await fetch('/api/create-server-wallet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: privyUserId }), // Ensure API expects 'userId'
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('API call to create server wallet failed:', result);
      throw new Error(result.error || 'Failed to create server wallet via API.');
    }

    console.log(`✅ Server wallet creation initiated successfully via API for ${privyUserId}. Result:`, result);
    // Note: We might not get the address back immediately if creation is async on the backend,
    // but the primary goal is to ensure the creation process is triggered.

  } catch (err: any) {
    console.error(`❌ Error in ensureServerWallet for user ${privyUserId}:`, err);
    // Re-throw the error to be caught by the calling function (in SupabaseAuthSyncProvider)
    throw new Error(`Failed to ensure server wallet: ${err.message}`);
  }
}
