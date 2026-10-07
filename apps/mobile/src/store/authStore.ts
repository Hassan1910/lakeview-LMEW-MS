import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { sessionSurvivesProfileError, type Profile, type UserRole } from '@lmew/shared-types';
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

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  role: null,
  isLoading: true,
  profileError: null,

  setSession: (session) => set({ session }),

  setProfile: (profile) => set({ profile, role: profile?.role ?? null, profileError: null }),

  setLoading: (isLoading) => set({ isLoading }),

  loadProfile: async () => {
    if (!get().profile) set({ isLoading: true });
    try {
      const supabase = getLmewSupabase();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        const current = get();
        if (sessionSurvivesProfileError(Boolean(current.session), sessionError.message)) {
          set({
            session: current.session,
            profile: current.profile,
            role: current.role,
            profileError: 'No connection. Check your internet and try again.',
            isLoading: false,
          });
          return;
        }
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
    } catch (error) {
      const current = get();
      set({
        session: current.session,
        profile: current.profile,
        role: current.role,
        profileError: error instanceof Error ? error.message : 'Could not reach the server.',
        isLoading: false,
      });
    }
  },

  signOut: () => {
    try {
      void getLmewSupabase().auth.signOut().catch(() => undefined);
      set({ session: null, profile: null, role: null, profileError: null, isLoading: false });
    } catch (error) {
      set({
        session: null,
        profile: null,
        role: null,
        isLoading: false,
        profileError: error instanceof Error ? error.message : 'Could not reach the server.',
      });
    }
  },
}));
