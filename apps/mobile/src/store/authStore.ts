import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { Profile, UserRole } from '@lmew/shared-types';
import { getLmewSupabase } from '@lmew/supabase-client';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;
  isLoading: boolean;
  profileError: string | null;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  loadProfile: () => Promise<void>;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  role: null,
  isLoading: true,
  profileError: null,

  setSession: (session) => set({ session }),

  setProfile: (profile) => set({ profile, role: profile?.role ?? null, profileError: null }),

  setLoading: (isLoading) => set({ isLoading }),

  loadProfile: async () => {
    const supabase = getLmewSupabase();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      set({ session: null, profile: null, role: null, profileError: sessionError.message, isLoading: false });
      return;
    }
    const session = sessionData.session;
    if (!session) {
      set({ session: null, profile: null, role: null, profileError: null, isLoading: false });
      return;
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (error || !data) {
      set({
        session,
        profile: null,
        role: null,
        profileError: error?.message ?? 'Your profile could not be loaded.',
        isLoading: false,
      });
      return;
    }
    const profile = data as Profile;
    set({ session, profile, role: profile.role, profileError: null, isLoading: false });
  },

  signOut: () => {
    void getLmewSupabase().auth.signOut().catch(() => undefined);
    set({ session: null, profile: null, role: null, profileError: null });
  },
}));
