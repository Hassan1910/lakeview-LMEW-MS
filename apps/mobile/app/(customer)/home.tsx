import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { db, myCustomerId, watchTable } from '../../src/lib/db';
import { ScreenBody } from '../../src/components/ScreenBody';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { MetricStrip } from '../../src/components/MetricStrip';
import { StatusStepper } from '../../src/components/StatusStepper';
import { AlertRow } from '../../src/components/AlertRow';
import { EmptyState } from '../../src/components/EmptyState';
import { StatusBadge } from '../../src/components/StatusBadge';
import { Notice } from '../../src/components/ui';
import { isPayableStatus, labelize, money } from '../../src/lib/format';
import { openNotification } from '../../src/lib/notificationRoutes';
import { useRefreshOnFocus } from '../../src/lib/focus';
import { useLanguage } from '../../src/i18n';
import { palette, radius, ui } from '../../src/theme';

const cacheKey = (userId: string) => `lmew.requests.cache.${userId}`;
const services = [
  { category: 'engine_maintenance', icon: 'engine-outline' },
  { category: 'boat_repair', icon: 'ferry' },
  { category: 'electrical', icon: 'flash-outline' },
  { category: 'welding', icon: 'fire' },
] as const;
const actions = [
  { label: 'New request', icon: 'plus', href: '/(customer)/new-request' },
  { label: 'Requests', icon: 'clipboard-text-outline', href: '/(customer)/my-requests' },
  { label: 'Invoices', icon: 'receipt', href: '/(customer)/invoices' },
  { label: 'Contact', icon: 'headset', href: '/(customer)/contact' },
] as const;

type RequestRow = { id: string; code: string | null; title: string; status: string };
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

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
  const invoices = useQuery({
    queryKey: ['my-invoices-summary', customer.data],
    enabled: Boolean(customer.data),
    queryFn: async () => {
      const { data, error } = await db().from('invoices').select('id, status, balance, currency').eq('customer_id', customer.data!);
      if (error) throw error;
      return data ?? [];
    },
  });
  const notes = useQuery({
    queryKey: ['notifications', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await db().from('notifications').select('id, title, body, type, read_at, created_at, data').eq('user_id', profile!.id).order('created_at', { ascending: false }).limit(5);
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

  useRefreshOnFocus(() => {
    void requests.refetch();
    void notes.refetch();
    void invoices.refetch();
  });

  const rows = requests.data?.rows ?? [];
  const activeRows = rows.filter((row) => !['completed', 'cancelled'].includes(row.status));
  const active = activeRows[0];
  const payable = (invoices.data ?? []).filter((row) => isPayableStatus(row.status));
  const due = payable.reduce((sum, row) => sum + Number(row.balance ?? 0), 0);
  const currency = payable[0]?.currency ?? 'KES';
  const first = profile?.full_name?.split(' ')[0] || 'there';

  const openNote = async (note: { id: string; read_at: string | null; data: unknown }) => {
    if (!note.read_at && profile) {
      await db().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', note.id).eq('user_id', profile.id);
      queryClient.invalidateQueries({ queryKey: ['notifications', profile.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications-all', profile.id] });
    }
    await openNotification(note.data as Record<string, unknown> | null, profile?.role ?? null);
  };

  return (
    <ScreenBody
      loading={customer.isLoading || (requests.isLoading && !requests.data)}
      skeleton={4}
      error={!requests.data && requests.error instanceof Error ? requests.error.message : customer.error instanceof Error ? customer.error.message : null}
      onRetry={() => { void customer.refetch(); void requests.refetch(); }}
    >
      <ScrollView contentContainerStyle={ui.pad}>
        <ScreenHeader eyebrow="Lakeview Marine" title={`Hello ${first}`} subtitle="Track a repair, start a new one, or pay an invoice." />
        {requests.data?.offline ? <Notice tone="info" text="Showing your last saved requests. Connect to refresh." /> : null}
        <MetricStrip items={[
          { label: 'Active requests', value: String(activeRows.length) },
          { label: 'Amount due', value: money(due, currency) },
        ]} />
        {invoices.error ? (
          <View style={{ gap: 8 }}>
            <Notice tone="error" text="Invoices could not be loaded." />
            <Pressable accessibilityRole="button" onPress={() => invoices.refetch()} style={styles.retry}>
              <Text style={styles.retryText}>Try invoices again</Text>
            </Pressable>
          </View>
        ) : null}
        {active ? (
          <View style={ui.card}>
            <View style={styles.cardTop}>
              <Text style={ui.section}>{t('active')}</Text>
              <StatusBadge kind="service" status={active.status} />
            </View>
            <Text style={styles.requestTitle} numberOfLines={2}>{active.title}</Text>
            {active.code ? <Text style={ui.caption}>{active.code}</Text> : null}
            <StatusStepper status={active.status} />
            <Pressable accessibilityRole="button" accessibilityLabel="Track this request" onPress={() => router.push(`/(customer)/request/${active.id}`)} style={styles.track}>
              <Text style={styles.trackText}>Track this request</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color="#FFFFFF" />
            </Pressable>
            {activeRows.length > 1 ? (
              <Pressable accessibilityRole="button" onPress={() => router.push('/(customer)/my-requests')} style={styles.textLink}>
                <Text style={styles.linkText}>View all {activeRows.length} active requests</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <EmptyState
            icon="clipboard-text-outline"
            title="No active request"
            message="Start one when a vessel needs work."
            actionLabel="New request"
            onAction={() => router.push('/(customer)/new-request')}
          />
        )}
        <Text style={ui.section}>Quick actions</Text>
        <View style={styles.grid}>
          {actions.map((action) => (
            <Pressable key={action.href} accessibilityRole="button" accessibilityLabel={action.label} onPress={() => router.push(action.href)} style={styles.tile}>
              <MaterialCommunityIcons name={action.icon as IconName} size={22} color={palette.primary} />
              <Text style={styles.tileLabel} numberOfLines={1}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={ui.section}>{t('recommended')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.services}>
          {services.map((service) => (
            <Pressable key={service.category} accessibilityRole="button" onPress={() => router.push(`/(customer)/search?category=${service.category}`)} style={styles.service}>
              <MaterialCommunityIcons name={service.icon} size={18} color={palette.primary} />
              <Text style={styles.serviceLabel}>{labelize(service.category)}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.sectionRow}>
          <Text style={ui.section}>Recent activity</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/(customer)/notifications')} hitSlop={8}>
            <Text style={styles.linkText}>See all</Text>
          </Pressable>
        </View>
        {(notes.data ?? []).length === 0 ? <Text style={ui.muted}>No notifications yet.</Text> : null}
        <View style={{ gap: 8 }}>
          {(notes.data ?? []).map((note) => (
            <AlertRow
              key={note.id}
              title={note.title}
              type={note.type}
              createdAt={note.created_at}
              unread={!note.read_at}
              onPress={() => openNote(note)}
            />
          ))}
        </View>
      </ScrollView>
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  requestTitle: { color: palette.text, fontSize: 17, fontWeight: '700', lineHeight: 22 },
  track: { minHeight: 44, borderRadius: radius.control, backgroundColor: palette.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  trackText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  textLink: { minHeight: 44, justifyContent: 'center' },
  linkText: { color: palette.primary, fontSize: 14, fontWeight: '700' },
  retry: { minHeight: 44, justifyContent: 'center' },
  retryText: { color: palette.primary, fontSize: 14, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    width: '48%',
    flexGrow: 1,
    minHeight: 72,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 14,
    gap: 6,
  },
  tileLabel: { color: palette.text, fontSize: 14, fontWeight: '600' },
  services: { gap: 8 },
  service: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  serviceLabel: { color: palette.text, fontSize: 14, fontWeight: '600' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
