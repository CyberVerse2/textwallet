import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

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
    
    // Use upsert pattern for user - only inserts if not exists
    const { error: upsertError } = await supabase
      .from('users')
      .upsert(
        {
          privy_user_id: userId,
          last_login: new Date().toISOString()
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
    
    // Get the user's server wallet from Supabase
    const { data, error } = await supabase
      .from('server_wallets')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    
    if (error || !data) {
      // No server wallet found, create one
      const createResponse = await fetch(`${url.origin}/api/create-server-wallet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      });
      
      if (!createResponse.ok) {
        throw new Error('Failed to create server wallet');
      }
      
      const { address } = await createResponse.json();
      console.log(`📩 Server Wallet API: Created new server wallet ${address} for user ${userId}`);
      
      return NextResponse.json({ address });
    }
    
    console.log(`📩 Server Wallet API: Retrieved address ${data.address} for user ${userId}`);
    
    return NextResponse.json({ address: data.address });
  } catch (error: any) {
    console.error('📩 Server Wallet API Error:', error);
    
    return NextResponse.json(
      { error: 'Failed to get server wallet address', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
