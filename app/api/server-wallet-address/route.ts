import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { _createServerWalletLogic } from '@/lib/server-wallet'; // Correct import path

export async function GET(req: Request) {
  try {
    console.log('📩 Server Wallet API: Fetching server wallet address');
    
    // Get the user ID from the query string
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }
    
    // Check for existing active server wallet
    const { data, error: fetchError } = await supabase
      .from('server_wallets')
      .select('address')
      .eq('user_id', userId)
      .eq('is_active', true) // Ensure we only get the active one
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = 'No rows found'
      console.error(`📩 Server Wallet API Error fetching wallet for user ${userId}:`, fetchError);
      return NextResponse.json(
        { error: 'Database error fetching wallet', details: fetchError.message },
        { status: 500 }
      );
    }

    // If wallet exists, return its address
    if (data) {
      console.log(`📩 Server Wallet API: Retrieved address ${data.address} for user ${userId}`);
      return NextResponse.json({ address: data.address });
    }

    // --- Wallet does not exist, create it --- 
    console.log(`📩 Server Wallet API: No active wallet found for user ${userId}. Creating one...`);
    
    // Call the extracted logic directly
    const creationResult = await _createServerWalletLogic(userId);
    
    // Handle potential errors during creation
    if ('error' in creationResult) {
       console.error(`📩 Server Wallet API Error during creation for user ${userId}:`, creationResult.error);
       const status = creationResult.status || 500;
       const errorDetails = creationResult.error instanceof Error ? creationResult.error.message : JSON.stringify(creationResult.error);
       return NextResponse.json(
           { error: 'Failed to create server wallet during lookup', details: errorDetails },
           { status: status }
       );
    }

    // Return the newly created address
    console.log(`📩 Server Wallet API: Created new server wallet ${creationResult.address} for user ${userId}`);
    return NextResponse.json({ address: creationResult.address });

  } catch (error: any) {
    console.error('📩 Server Wallet API Unexpected Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json(
      { error: 'Failed to get server wallet address', details: errorMessage },
      { status: 500 }
    );
  }
}
