import React, { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { Link } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../../src/store/authStore';
import { db, myCustomerId, watchTable } from '../../src/lib/db';
import { ScreenBody } from '../../src/components/ScreenBody';
import { StatusStepper } from '../../src/components/StatusStepper';
import { Notice } from '../../src/components/ui';
import { labelize } from '../../src/lib/format';
import { openNotification } from '../../src/lib/notificationRoutes';
import { useLanguage } from '../../src/i18n';
import { serviceStatusConfig } from '@lmew/ui-tokens';
import { ui } from '../../src/theme';

const cacheKey = (userId: string) => `lmew.requests.cache.${userId}`;
const services = ['engine_maintenance', 'boat_repair', 'electrical', 'welding'] as const;

type RequestRow = { id: string; code: string | null; title: string; status: string };

export default function CustomerHome() {
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const customer = useQuery({
    queryKey: ['my-customer', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: () => myCustomerId(profile!.id),
  });
  const requests = useQuery({
    queryKey: ['my-requests', customer.data],
    enabled: Boolean(customer.data),
    queryFn: async () => {
      try {
        const { data, error } = await db()
          .from('service_requests')
          .select('id, code, title, status')
          .eq('customer_id', customer.data!)
          .order('created_at', { ascending: false });
        if (error) throw error;
        const rows = (data ?? []) as RequestRow[];
        await AsyncStorage.setItem(cacheKey(profile!.id), JSON.stringify(rows));
        return { rows, offline: false };
      } catch (error) {
        const cached = await AsyncStorage.getItem(cacheKey(profile!.id));
        if (!cached) throw error;
        return { rows: JSON.parse(cached) as RequestRow[], offline: true };
      }
    },
  });
  const notes = useQuery({
    queryKey: ['notifications', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await db().from('notifications').select('id, title, body, read_at, data').eq('user_id', profile!.id).order('created_at', { ascending: false }).limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!profile?.id) return;
    const stopNotes = watchTable('notifications', () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', profile.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications-all', profile.id] });
    }, `user_id=eq.${profile.id}`);
    const stopRequests = watchTable('service_requests', () => queryClient.invalidateQueries({ queryKey: ['my-requests'] }));
    return () => { stopNotes(); stopRequests(); };
  }, [profile?.id, queryClient]);

  const rows = requests.data?.rows ?? [];
  const active = rows.find((row) => !['completed', 'cancelled'].includes(row.status));
  const label = active ? serviceStatusConfig[active.status as keyof typeof serviceStatusConfig]?.label : null;

  const openNote = async (note: { id: string; read_at: string | null; data: unknown }) => {
    if (!note.read_at && profile) {
      await db().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', note.id).eq('user_id', profile.id);
      queryClient.invalidateQueries({ queryKey: ['notifications', profile.id] });
    }
    openNotification(note.data as Record<string, unknown> | null, profile?.role ?? null);
  };

  return (
    <ScreenBody
      loading={customer.isLoading || (requests.isLoading && !requests.data)}
      error={!requests.data && requests.error instanceof Error ? requests.error.message : customer.error instanceof Error ? customer.error.message : null}
      onRetry={() => { void customer.refetch(); void requests.refetch(); }}
    >
      <ScrollView contentContainerStyle={ui.pad}>
        <Text style={ui.title}>Hello {profile?.full_name?.split(' ')[0] || 'there'}</Text>
        <Text style={ui.muted}>Track a repair, start a new one, or pay an invoice.</Text>
        {requests.data?.offline ? <Notice tone="info" text="Showing your last saved requests. Connect to refresh." /> : null}
        {active ? (
          <View style={ui.card}>
            <Text style={ui.section}>{t('active')}</Text>
            <Text style={ui.body}>{active.title}</Text>
            <Text style={ui.muted}>{[active.code, label ?? labelize(active.status)].filter(Boolean).join(' · ')}</Text>
            <StatusStepper status={active.status} />
            <Link href={`/(customer)/request/${active.id}`} asChild><Button mode="contained">Track this request</Button></Link>
          </View>
        ) : (
          <View style={ui.card}>
            <Text style={ui.body}>No active request.</Text>
            <Text style={ui.muted}>Start one when a vessel needs work.</Text>
          </View>
        )}
        <View style={ui.row}>
          <Link href="/(customer)/new-request" asChild><Button mode="contained">New request</Button></Link>
          <Link href="/(customer)/my-requests" asChild><Button mode="outlined">All requests</Button></Link>
          <Link href="/(customer)/invoices" asChild><Button mode="outlined">Pay</Button></Link>
        </View>
        <Text style={ui.section}>{t('recommended')}</Text>
        <View style={ui.row}>
          {services.map((category) => (
            <Link key={category} href={`/(customer)/search?category=${category}`} asChild>
              <Button mode="outlined">{labelize(category)}</Button>
            </Link>
          ))}
        </View>
        <Text style={ui.section}>Recent notifications</Text>
        {(notes.data ?? []).map((note) => (
          <Button key={note.id} mode="text" onPress={() => openNote(note)}>{note.title}{note.read_at ? '' : ' · New'}</Button>
        ))}
        {!notes.data?.length ? <Text style={ui.muted}>No notifications.</Text> : null}
        <Link href="/(customer)/notifications" asChild><Button mode="text">See all notifications</Button></Link>
      </ScrollView>
    </ScreenBody>
  );
}
