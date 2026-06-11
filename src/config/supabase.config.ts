import { createClient } from '@supabase/supabase-js';
import { env } from './env.config';

// Stateless auth for shared server-side singletons: these clients are reused
// across every request, so they must not persist or auto-refresh any single
// user's session between requests.
const STATELESS_AUTH = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
} as const;

// Public client (uses anon key — safe for browser/mobile use).
export const supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, STATELESS_AUTH);

// Admin client (uses service role key — server-side ONLY, never expose to client).
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  STATELESS_AUTH,
);
