import { createClient, SupabaseClient, SupportedStorage } from '@supabase/supabase-js';

declare const process: any;

export interface LmewSupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  authStorage?: SupportedStorage;
  autoRefreshToken?: boolean;
  persistSession?: boolean;
}

let clientInstance: SupabaseClient | null = null;

export function initLmewSupabase(config: LmewSupabaseConfig): SupabaseClient {
  clientInstance = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      storage: config.authStorage,
      autoRefreshToken: config.autoRefreshToken ?? true,
      persistSession: config.persistSession ?? true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
  return clientInstance;
}

export function getLmewSupabase(): SupabaseClient {
  if (!clientInstance) {
    const url = typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL : '';
    const key = typeof process !== 'undefined' ? process.env.VITE_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY : '';
    
    if (url && key) {
      return initLmewSupabase({ supabaseUrl: url, supabaseAnonKey: key });
    }
    throw new Error('Supabase client has not been initialized. Call initLmewSupabase first.');
  }
  return clientInstance;
}
