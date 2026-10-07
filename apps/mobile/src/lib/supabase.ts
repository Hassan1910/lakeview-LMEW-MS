import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { getLmewSupabase, initLmewSupabase } from '@lmew/supabase-client';

const authStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const extra = Constants.expoConfig?.extra as { supabaseUrl?: string; supabaseAnonKey?: string } | undefined;

function firstString(...values: Array<string | undefined>) {
  return values.find((value) => typeof value === 'string' && value.length > 0) ?? '';
}

const supabaseUrl = firstString(extra?.supabaseUrl, process.env.EXPO_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = firstString(extra?.supabaseAnonKey, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

if (supabaseUrl && supabaseAnonKey) {
  try {
    getLmewSupabase();
  } catch {
    initLmewSupabase({
      supabaseUrl,
      supabaseAnonKey,
      authStorage,
      autoRefreshToken: true,
      persistSession: true,
    });
  }
}
