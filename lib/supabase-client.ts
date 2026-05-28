import { createClient } from '@supabase/supabase-js';
import { getConfig } from './config-service';

const config = getConfig();

// Since some operations occur server-side (like bypass RLS, user creation, etc.)
// we export a supabase client instance that is initialized with the service key if present in process.env,
// otherwise falling back to publishable key.
const supabaseUrl = config.supabase.url || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || config.supabase.publishableKey || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
