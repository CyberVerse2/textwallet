import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    // Get the wallet address from the query string
    const url = new URL(req.url);
    const address = url.searchParams.get('address');
    
    if (!address) {
      return NextResponse.json(
        { error: 'Missing address parameter' },
        { status: 400 }
      );
    }
    
    // Create a Base mainnet RPC provider
    const response = await fetch('https://mainnet.base.org', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address, 'latest'],
        id: 1,
      }),
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`);
    }
    
    return NextResponse.json({ balance: data.result });
  } catch (error: any) {
    console.error('🔍 Balance API Error:', error);
    
    return NextResponse.json(
      { error: 'Failed to get balance', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
