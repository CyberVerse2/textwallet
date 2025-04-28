import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Ensure environment variables are loaded
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing environment variable NEXT_PUBLIC_SUPABASE_URL');
}
if (!supabaseServiceRoleKey) {
  throw new Error('Missing environment variable SUPABASE_SERVICE_ROLE_KEY');
}


// Create a single supabase admin client for interacting with your database
// Note: this admin client bypasses RLS policies
const supabaseAdmin: SupabaseClient = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      // Prevent client from trying to use browser storage
      persistSession: false,
      // Automatically refresh tokens (not strictly necessary for service_role, but good practice)
      autoRefreshToken: true,
      // Detect session from cookies (not applicable for service_role)
      detectSessionInUrl: false,
    },
  }
);

export default supabaseAdmin;
