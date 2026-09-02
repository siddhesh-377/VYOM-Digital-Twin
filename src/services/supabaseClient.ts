import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read from Vite environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    !supabaseUrl.includes('your-vyom-project') &&
    supabaseUrl.startsWith('http')
  );
};

let supabaseInstance: SupabaseClient | null = null;

if (isSupabaseConfigured()) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    console.info('🛰️ [VYOM Supabase] Connected to Supabase real-time database:', supabaseUrl);
  } catch (err) {
    console.warn('⚠️ [VYOM Supabase] Failed to initialize Supabase client:', err);
    supabaseInstance = null;
  }
} else {
  console.info('ℹ️ [VYOM Supabase] Running in local/authoritative simulation mode (Supabase URL not configured)');
}

export const supabase = supabaseInstance;
