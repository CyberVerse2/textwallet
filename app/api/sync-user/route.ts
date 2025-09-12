import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();
    if (!address || typeof address !== 'string') {
      return NextResponse.json({ message: 'Missing address' }, { status: 400 });
    }

    const normalized = address.toLowerCase();

    // Upsert user by wallet_address; if column not present yet, this will fail
    const { data, error } = await supabaseAdmin
      .from('users')
      .upsert(
        {
          // Keep privy_user_id null when migrating; schema currently requires NOT NULL, so we only update last_login if record exists
          // Once migration adds wallet_address, we will set it here and remove privy dependency
          last_login: new Date().toISOString(),
          // @ts-ignore - will rely on DB migration to add wallet_address
          wallet_address: normalized
        },
        { onConflict: 'wallet_address' as any }
      )
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ message: 'Upsert failed', error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'User synced', user: data }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: 'Sync failed' }, { status: 500 });
  }
}
