import { getLmewSupabase, initLmewSupabase, subscribePostgresChanges } from '@lmew/supabase-client';

function publicEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string | undefined {
  const runtime = typeof window !== 'undefined' ? window.__LMEW_PUBLIC_ENV__?.[name] : undefined;
  if (runtime) return runtime;
  return import.meta.env[name] as string | undefined;
}

const url = publicEnv('VITE_SUPABASE_URL');
const key = publicEnv('VITE_SUPABASE_ANON_KEY');

export const REMEMBER_KEY = 'lmew-remember';

export function prefersRememberedSession() {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setRememberMe(remember: boolean) {
  localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
}

function activeAuthStore(): Storage {
  return prefersRememberedSession() ? localStorage : sessionStorage;
}

const authStorage = {
  getItem(storageKey: string) {
    return activeAuthStore().getItem(storageKey);
  },
  setItem(storageKey: string, value: string) {
    const active = activeAuthStore();
    const other = active === localStorage ? sessionStorage : localStorage;
    other.removeItem(storageKey);
    active.setItem(storageKey, value);
  },
  removeItem(storageKey: string) {
    localStorage.removeItem(storageKey);
    sessionStorage.removeItem(storageKey);
  },
};

export const supabase = url && key ? initLmewSupabase({ supabaseUrl: url, supabaseAnonKey: key, authStorage }) : getSafeClient();

function getSafeClient() {
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
