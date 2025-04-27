import type { NextApiRequest, NextApiResponse } from 'next';
import { PrivyClient } from '@privy-io/server-auth';
import supabaseAdmin from '@/lib/supabaseAdmin'; // Use the admin client

// Initialize Privy client
const privyAppId = process.env.PRIVY_APP_ID;
const privyAppSecret = process.env.PRIVY_APP_SECRET;

if (!privyAppId || !privyAppSecret) {
  throw new Error('Missing PRIVY_APP_ID or PRIVY_APP_SECRET environment variables');
}

const privy = new PrivyClient(privyAppId, privyAppSecret);

type Data = {
  message: string;
  userId?: string;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const authToken = req.headers.authorization?.replace('Bearer ', '');

  if (!authToken) {
    return res.status(401).json({ message: 'Authorization token missing' });
  }

  try {
    // Verify the token with Privy
    console.log('[API Sync] Verifying Privy token...');
    const verifiedClaims = await privy.verifyAuthToken(authToken);
    const privyUserId = verifiedClaims.userId; // This is the user's Privy DID
    console.log('[API Sync] Privy token verified for user:', privyUserId);

    // Upsert user data using Supabase Admin Client (bypasses RLS)
    console.log('[API Sync] Upserting user record in Supabase...');
    const { error: upsertError } = await supabaseAdmin
      .from('users')
      .upsert(
        {
          privy_user_id: privyUserId,
          last_login: new Date().toISOString(),
          // Add other fields like email if needed, accessible from verifiedClaims
          // email: verifiedClaims.email?.address, // Example: if email is in the token
        },
        {
          onConflict: 'privy_user_id', // Ensure this matches your table constraint
          ignoreDuplicates: false,
        }
      );

    if (upsertError) {
      console.error('[API Sync] Supabase upsert error:', upsertError);
      throw new Error(`Supabase error: ${upsertError.message}`);
    }

    console.log('[API Sync] User record upserted successfully for:', privyUserId);
    return res.status(200).json({ message: 'User synced successfully', userId: privyUserId });

  } catch (error: any) {
    console.error('[API Sync] Error verifying token or upserting user:', error);
    // Check for specific Privy verification errors if needed
    // if (error instanceof PrivyClientError) { ... }
    return res.status(500).json({ message: 'Failed to sync user', error: error.message || 'Unknown error' });
  }
}
