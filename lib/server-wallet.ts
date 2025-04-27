import { supabase } from '@/lib/supabaseClient';
import { Wallet } from 'ethers';
import { encrypt } from '@/lib/encryption'; // Assuming encryption utility exists

// Core logic for creating a server wallet
export async function _createServerWalletLogic(userId: string): Promise<{ address: string } | { error: any, status?: number }> {
  try {
    console.log(`🔑 Creating server wallet for user: ${userId}`);

    // 1. Create a new wallet
    const wallet = Wallet.createRandom();
    const address = wallet.address;
    const privateKey = wallet.privateKey;

    // 2. Encrypt the private key
    if (!process.env.WALLET_ENCRYPTION_KEY) {
      console.error('Missing WALLET_ENCRYPTION_KEY');
      return { error: 'Server configuration error: Missing encryption key', status: 500 };
    }
    const encryptedPrivateKey = encrypt(privateKey, process.env.WALLET_ENCRYPTION_KEY);

    // 3. Insert into the database
    const { error: insertError } = await supabase
      .from('server_wallets')
      .insert({
        user_id: userId,
        address: address,
        encrypted_private_key: encryptedPrivateKey,
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
