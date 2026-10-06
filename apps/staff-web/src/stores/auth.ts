import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Session } from '@lmew/supabase-client';
import type { Profile, UserRole } from '@lmew/shared-types';
import { db } from '../lib/supabase';

export const STAFF_ROLES: UserRole[] = ['store_manager', 'procurement_officer', 'receptionist', 'supplier', 'administrator'];

export const useAuthStore = defineStore('auth', () => {
  let ready: Promise<void> | null = null;
  const session = ref<Session | null>(null);
  const profile = ref<Profile | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);

  async function loadProfile(userId: string) {
    const { data, error: profileError } = await db().from('profiles').select('*').eq('id', userId).single();
    if (profileError || !data) {
      error.value = profileError?.message ?? 'Profile missing';
      profile.value = null;
      return;
    }
    if (!data.is_active) {
      await db().auth.signOut();
      error.value = 'This account is disabled';
      profile.value = null;
      return;
    }
    if (!STAFF_ROLES.includes(data.role)) {
      await db().auth.signOut();
      error.value = 'This portal is for store, procurement, reception, and supplier roles';
      profile.value = null;
      return;
    }
    profile.value = data as Profile;
    error.value = null;
  }

  async function init() {
    if (!ready) ready = load();
    await ready;
  }

  async function load() {
    try {
      const { data } = await db().auth.getSession();
      session.value = data.session;
      if (data.session) await loadProfile(data.session.user.id);
      db().auth.onAuthStateChange(async (_event, next) => {
        session.value = next;
        if (next) await loadProfile(next.user.id);
        else profile.value = null;
      });
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Supabase is not configured';
    } finally {
      loading.value = false;
    }
  }

  async function signIn(email: string, password: string) {
    const { data, error: signInError } = await db().auth.signInWithPassword({ email, password });
    if (signInError) return signInError.message;
    if (data.user) await loadProfile(data.user.id);
    return error.value;
  }

  async function signOut() {
    await db().auth.signOut();
    profile.value = null;
  }

  return { session, profile, loading, error, init, signIn, signOut };
});
