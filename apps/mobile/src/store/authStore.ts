import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { Profile, UserRole } from '@lmew/shared-types';
import { getLmewSupabase } from '@lmew/supabase-client';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  role: null,
  isLoading: true,

  setSession: (session) =>
    set({ session }),

  setProfile: (profile) =>
    set({ profile, role: profile?.role ?? null }),

  setLoading: (isLoading) =>
    set({ isLoading }),

  signOut: () => {
    void getLmewSupabase().auth.signOut().catch(() => undefined);
    set({ session: null, profile: null, role: null });
  },
}));
