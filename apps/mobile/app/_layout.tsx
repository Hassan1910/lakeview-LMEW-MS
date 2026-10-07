import '../src/lib/supabase';
import React, { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lmewMobileTheme, palette } from '../src/theme';
import { useAuthStore } from '../src/store/authStore';
import { getLmewSupabase } from '@lmew/supabase-client';
import type { UserRole } from '@lmew/shared-types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { listenForNotificationTaps, registerPushToken } from '../src/lib/push';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
    },
  },
});

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

const header = {
  headerStyle: { backgroundColor: palette.primary },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: { fontWeight: '600' as const },
  headerShadowVisible: false,
};

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const isLoading = useAuthStore((s) => s.isLoading);
  const setSession = useAuthStore((s) => s.setSession);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setLoading = useAuthStore((s) => s.setLoading);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const previousUser = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let supabase: ReturnType<typeof getLmewSupabase>;
    try {
      supabase = getLmewSupabase();
    } catch {
      setLoading(false);
      return;
    }

    void loadProfile()
      .then(() => {
        const current = useAuthStore.getState().profile;
        if (current?.id) void registerPushToken(current.id);
      })
      .catch(() => undefined);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        return;
      }
      const current = useAuthStore.getState().profile;
      if (!current || current.id !== nextSession.user.id) setLoading(true);
      // Defer the profile query. Awaiting Supabase inside this callback can deadlock the auth client.
      setTimeout(() => {
        void loadProfile()
          .then(() => {
            const current = useAuthStore.getState().profile;
            if (current?.id) void registerPushToken(current.id);
          })
          .catch(() => undefined);
      }, 0);
    });

    return () => subscription.unsubscribe();
  }, [loadProfile, setLoading, setProfile, setSession]);

  useEffect(() => {
    if (!profile?.role) return;
    return listenForNotificationTaps(profile.role);
  }, [profile?.role]);

  useEffect(() => {
    const userId = session?.user.id ?? null;
    if (previousUser.current === undefined) {
      previousUser.current = userId;
      return;
    }
    if (previousUser.current !== userId) {
      queryClient.clear();
      void AsyncStorage.removeItem(`lmew.requests.cache.${previousUser.current}`);
    }
    previousUser.current = userId;
  }, [session?.user.id]);

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

    if (session && !profile) {
      const atRoot = segments.length === 0 || segments[0] === 'index';
      if (!atRoot) router.replace('/');
      return;
    }

    if (!session || !profile) return;
    const home = homeForRole(profile.role);
    if (group === 'paystack') {
      if (profile.role !== 'customer') router.replace(home);
      return;
    }
    const allowed = groupForRole(profile.role);
    if (group !== allowed) router.replace(home);
  }, [session, isLoading, segments, profile, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={lmewMobileTheme}>
        <StatusBar style="light" />
        <AuthGuard>
          <Stack screenOptions={header}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(customer)" options={{ headerShown: false }} />
            <Stack.Screen name="(technician)" options={{ headerShown: false }} />
            <Stack.Screen name="(supervisor)" options={{ headerShown: false }} />
            <Stack.Screen name="portal" options={{ title: 'Web portal' }} />
            <Stack.Screen name="paystack" options={{ headerShown: false }} />
          </Stack>
        </AuthGuard>
      </PaperProvider>
    </QueryClientProvider>
  );
}
