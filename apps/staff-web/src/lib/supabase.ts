import { getLmewSupabase, initLmewSupabase, subscribePostgresChanges } from '@lmew/supabase-client';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

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
