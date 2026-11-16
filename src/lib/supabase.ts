import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

/**
 * True when the app has credentials. The anon key is public by design — row
 * level security decides what each request may do — so it ships in the bundle.
 */
export const isConfigured = Boolean(url && anonKey);
/** For the few calls supabase-js has no method for (the auth settings). */
export const supabaseUrl = url ?? 'http://localhost:54321';
export const supabaseKey = anonKey ?? 'missing-anon-key';

export const supabase: SupabaseClient = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'missing-anon-key',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);
