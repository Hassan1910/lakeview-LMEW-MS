import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@lmew/supabase-client';
import type { Profile, Role } from '@lmew/shared-types';
import { db } from '../lib/supabase';

interface AuthValue {
  session: Session | null;
  profile: Profile | null;
  role: Role | null;
  permissions: ReadonlySet<string>;
  loading: boolean;
  error: string | null;
  can: (key: string) => boolean;
  canAny: (keys: string[]) => boolean;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);
const EMPTY: ReadonlySet<string> = new Set();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<ReadonlySet<string>>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userId = useRef<string | null>(null);

  const clear = useCallback(() => {
    setProfile(null);
    setRole(null);
    setPermissions(EMPTY);
  }, []);

  const load = useCallback(async (id: string) => {
    const [profileResult, permissionResult] = await Promise.all([
      db().from('profiles').select('*, roles:role_id (*)').eq('id', id).single(),
      db().rpc('my_permissions'),
    ]);
    const { data, error: profileError } = profileResult;
    if (profileError || !data) {
      setError(profileError?.message ?? 'Profile missing');
      clear();
      return;
    }
    const { roles: roleRow, ...rest } = data as Profile & { roles: Role | null };
    if (!rest.is_active) {
      await db().auth.signOut();
      setError('This account is suspended. Ask an administrator to restore it.');
      clear();
      return;
    }
    const granted = new Set<string>(((permissionResult.data ?? []) as unknown[]).map(String));
    if (permissionResult.error || !granted.has('portal.access')) {
      await db().auth.signOut();
      setError(permissionResult.error?.message ?? 'Your role does not include access to the web dashboard.');
      clear();
      return;
    }
    setProfile(rest as Profile);
    setRole(roleRow);
    setPermissions(granted);
    setError(null);
  }, [clear]);

  useEffect(() => {
    let client: ReturnType<typeof db>;
    try {
      client = db();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Supabase is not configured');
      setLoading(false);
      return;
    }
    client.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      userId.current = data.session?.user.id ?? null;
      if (data.session) await load(data.session.user.id);
      setLoading(false);
    });
    const { data: sub } = client.auth.onAuthStateChange((event, next) => {
      setSession(next);
      const nextId = next?.user.id ?? null;
      const changed = nextId !== userId.current;
      userId.current = nextId;
      if (!next) {
        clear();
        return;
      }
      // Supabase deadlocks if the callback awaits other auth calls, so defer the load.
      if (changed || event === 'USER_UPDATED') {
        if (changed) setLoading(true);
        setTimeout(() => void load(next.user.id).finally(() => setLoading(false)), 0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [load, clear]);

  const refresh = useCallback(async () => {
    if (userId.current) await load(userId.current);
  }, [load]);

  // An administrator may change this user's role while they are signed in.
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [refresh]);

  const value = useMemo<AuthValue>(() => {
    const can = (key: string) => permissions.has(key);
    return {
      session,
      profile,
      role,
      permissions,
      loading,
      error,
      can,
      canAny: (keys) => keys.some(can),
      refresh,
      signIn: async (email, password) => {
        setError(null);
        const { error: signInError } = await db().auth.signInWithPassword({ email, password });
        return signInError?.message ?? null;
      },
      signOut: async () => {
        await db().auth.signOut();
        clear();
      },
    };
  }, [session, profile, role, permissions, loading, error, refresh, clear]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider missing');
  return value;
}
