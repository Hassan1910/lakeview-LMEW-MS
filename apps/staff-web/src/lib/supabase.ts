import { getLmewSupabase, initLmewSupabase, subscribePostgresChanges } from '@lmew/supabase-client';

function publicEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string | undefined {
  const runtime = typeof window !== 'undefined' ? window.__LMEW_PUBLIC_ENV__?.[name] : undefined;
  if (runtime) return runtime;
  return import.meta.env[name] as string | undefined;
}

const url = publicEnv('VITE_SUPABASE_URL');
const key = publicEnv('VITE_SUPABASE_ANON_KEY');

export const supabase = url && key ? initLmewSupabase({ supabaseUrl: url, supabaseAnonKey: key }) : safe();

function safe() {
  try {
    return getLmewSupabase();
  } catch {
    return null;
  }
}

export function db() {
  if (!supabase) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  return supabase;
}

export function watch(table: string, onChange: () => void, filter?: string) {
  return subscribePostgresChanges(db(), table, onChange, filter);
}
