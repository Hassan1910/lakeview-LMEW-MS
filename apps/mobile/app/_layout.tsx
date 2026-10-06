import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lmewMobileTheme } from '../src/theme';
import { useAuthStore } from '../src/store/authStore';
import { getLmewSupabase, initLmewSupabase } from '@lmew/supabase-client';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import type { Profile, UserRole } from '@lmew/shared-types';
import { listenForNotificationTaps, registerPushToken } from '../src/lib/push';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

/** Custom SecureStore adapter for Supabase auth persistence on mobile */
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

function InitSupabase() {
  const supabaseUrl =
    Constants.expoConfig?.extra?.supabaseUrl ??
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    '';
  const supabaseAnonKey =
    Constants.expoConfig?.extra?.supabaseAnonKey ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    '';

  if (supabaseUrl && supabaseAnonKey) {
    try {
      getLmewSupabase();
    } catch {
      initLmewSupabase({
        supabaseUrl,
        supabaseAnonKey,
        authStorage: ExpoSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
      });
    }
  }
  return null;
}

function homeForRole(role: UserRole) {
  if (role === 'customer') return '/(customer)/home';
  if (role === 'technician') return '/(technician)/home';
  if (role === 'supervisor') return '/(supervisor)/home';
  return '/portal';
}

function groupForRole(role: UserRole) {
  if (role === 'customer') return '(customer)';
  if (role === 'technician') return '(technician)';
  if (role === 'supervisor') return '(supervisor)';
  return 'portal';
}

/** Auth guard — redirects unauthenticated users to login */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { session, profile, isLoading, setSession, setProfile, setLoading } = useAuthStore();

  useEffect(() => {
    let supabase: ReturnType<typeof getLmewSupabase>;
    try {
      supabase = getLmewSupabase();
    } catch {
      setLoading(false);
      return;
    }

    // Load initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setProfile(data as Profile | null);
        if (data?.id) void registerPushToken(data.id);
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (session) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setProfile(data as Profile | null);
        if (data?.id) void registerPushToken(data.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!profile?.role) return;
    return listenForNotificationTaps(profile.role);
  }, [profile?.role]);

  useEffect(() => {
    if (isLoading) return;
    const group = segments[0];
    const inAuthGroup = group === '(auth)';

    if (session && profile && profile.is_active === false) {
      useAuthStore.getState().signOut();
      router.replace('/(auth)/login');
      return;
    }

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    if (!session || !profile) return;
    const home = homeForRole(profile.role);
    const allowed = groupForRole(profile.role);
    if (group !== allowed) router.replace(home);
  }, [session, isLoading, segments, profile]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={lmewMobileTheme}>
        <StatusBar style="light" backgroundColor="#0B4F6C" />
        <InitSupabase />
        <AuthGuard>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: '#0B4F6C' },
              headerTintColor: '#FFFFFF',
              headerTitleStyle: { fontWeight: 'bold' },
            }}
          >
            <Stack.Screen name="index" options={{ title: 'Lakeview Marine Works' }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(customer)" options={{ headerShown: false }} />
            <Stack.Screen name="(technician)" options={{ headerShown: false }} />
            <Stack.Screen name="(supervisor)" options={{ headerShown: false }} />
            <Stack.Screen name="portal" options={{ title: 'Web portal' }} />
          </Stack>
        </AuthGuard>
      </PaperProvider>
    </QueryClientProvider>
  );
}
