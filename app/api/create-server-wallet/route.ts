import { NextResponse } from 'next/server';
import { PrivyEvmWalletProvider } from '@coinbase/agentkit';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }
    
    console.log(`🔑 Creating server wallet for user: ${userId}`);
    
    // Use upsert pattern for user - only inserts if not exists
    const { error: upsertError } = await supabase
      .from('users')
      .upsert(
        {
          privy_user_id: userId,
          last_login: new Date().toISOString(),
        },
        { 
          onConflict: 'privy_user_id',
          ignoreDuplicates: true 
        }
      );
      
    if (upsertError) {
      console.error('Warning - user upsert issue:', upsertError);
      // Continue anyway - user might already exist
    }
    
    // Check for existing server wallet
    const { data: existingWallet } = await supabase
      .from('server_wallets')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    
    if (existingWallet) {
      console.log(`🔑 User already has server wallet: ${existingWallet.address}`);
      return NextResponse.json({ address: existingWallet.address });
    }
    
    // Verify environment variables exist
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const appSecret = process.env.NEXT_PUBLIC_PRIVY_APP_SECRET;
    
    if (!appId || !appSecret) {
      throw new Error('Missing Privy credentials');
    }
    
    // Create wallet config with deterministic seed based on user ID
    // This ensures the same wallet is generated for a user even if regenerated
    const walletConfig = {
      appId,
      appSecret,
      chainId: process.env.PRIVY_CHAIN_ID || '8453', // Base mainnet
      userId: `server-wallet-${userId}` // Make deterministic for the user
    };
    
    // Create a wallet provider
    const walletProvider = await PrivyEvmWalletProvider.configureWithWallet(walletConfig);
    
    // Get the server wallet address
    const address = await walletProvider.getAddress();
    
    console.log(`🔑 Created server wallet: ${address} for user: ${userId}`);
    
    // Store in Supabase
    await supabase.from('server_wallets').insert({
      user_id: userId,
      address,
      chain_id: 8453, // Base mainnet
      is_active: true,
      balance: '0',
      last_used: new Date().toISOString()
    });
    
    return NextResponse.json({ address });
  } catch (error: any) {
    console.error('Error creating server wallet:', error);
    
    return NextResponse.json(
      { error: 'Failed to create server wallet', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
