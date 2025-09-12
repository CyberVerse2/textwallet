import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();
    if (!address || typeof address !== 'string') {
      return NextResponse.json({ message: 'Missing address' }, { status: 400 });
    }

    const normalized = address.toLowerCase();

    // Ensure user exists first to satisfy FK constraints
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('wallet_address')
      .eq('wallet_address', normalized)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json(
        { message: 'Lookup failed', error: fetchError.message },
        { status: 500 }
      );
    }

    if (!existing) {
      const { error: insertError } = await supabaseAdmin.from('users').insert({
        wallet_address: normalized,
        email: null,
        last_login: new Date().toISOString()
      });
      if (insertError) {
        return NextResponse.json(
          { message: 'Insert failed', error: insertError.message },
          { status: 500 }
        );
      }
    } else {
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('wallet_address', normalized);
      if (updateError) {
        return NextResponse.json(
          { message: 'Update failed', error: updateError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ message: 'User synced', address: normalized }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: 'Sync failed' }, { status: 500 });
  }
}
