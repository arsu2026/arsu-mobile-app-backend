import { createClient } from '@supabase/supabase-js';
import { env } from './env.config';

// Public client (uses anon key — safe for browser/mobile use)
export const supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

// Admin client (uses service role key — server-side ONLY, never expose to client)
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
