import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../src/store/authStore';
import { db, watchTable } from '../../src/lib/db';
import { Screen } from '../../src/components/ui';
import { SegmentedControl } from '../../src/components/SegmentedControl';
import { RecordCard } from '../../src/components/RecordCard';
import { EmptyState } from '../../src/components/EmptyState';
import { SkeletonList } from '../../src/components/Skeleton';
import { PriorityBadge, StatusBadge } from '../../src/components/StatusBadge';
import { formatWhen, friendlyError, labelize, one } from '../../src/lib/format';
import { useRefreshOnFocus } from '../../src/lib/focus';
import { palette, ui } from '../../src/theme';

const tabs = [
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

type Tab = (typeof tabs)[number]['value'];

export default function MyJobs() {
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('assigned');
  const query = useQuery({
    queryKey: ['jobs', profile?.id, tab],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await db()
        .from('work_orders')
        .select('id, code, status, scheduled_start, service_request:service_requests(title, priority, location_text, vessel:vessels(name), customer:customers(company_name, profile:profiles!profile_id(full_name)))')
        .eq('assigned_to', profile!.id)
        .eq('status', tab)
        .order('scheduled_start', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  useRefreshOnFocus(() => { if (profile?.id) void query.refetch(); });
  useEffect(() => {
    if (!profile?.id) return;
    return watchTable('work_orders', () => queryClient.invalidateQueries({ queryKey: ['jobs', profile.id] }), `assigned_to=eq.${profile.id}`);
  }, [profile?.id, queryClient]);

  const label = tabs.find((item) => item.value === tab)?.label ?? labelize(tab);

  return (
    <Screen>
      <FlatList
        data={query.data ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={palette.primary} />}
        contentContainerStyle={[ui.pad, !(query.data ?? []).length ? { flexGrow: 1 } : null]}
        ListHeaderComponent={
          <View style={{ marginBottom: 12 }}>
            <SegmentedControl options={tabs.map((item) => ({ value: item.value, label: item.label }))} value={tab} onChange={setTab} />
          </View>
        }
        ListEmptyComponent={
          query.isLoading ? <SkeletonList count={3} />
            : query.error ? (
              <EmptyState
                icon="alert-circle-outline"
                title="Jobs could not be loaded"
                message={friendlyError(query.error)}
                actionLabel="Try again"
                onAction={() => query.refetch()}
              />
            ) : (
              <EmptyState icon="clipboard-list-outline" title={`No ${label.toLowerCase()} jobs`} message="Switch filters to see the rest of your work." />
            )
        }
        renderItem={({ item }) => {
          const request = one(item.service_request);
          const customer = one(request?.customer);
          const person = one(customer?.profile);
          const customerName = customer?.company_name || person?.full_name || '';
          const vessel = one(request?.vessel)?.name ?? '';
          const when = item.scheduled_start ? formatWhen(item.scheduled_start) : 'Unscheduled';
          return (
            <RecordCard
              title={request?.title || item.code || 'Job'}
              subtitle={item.code}
              badges={<><StatusBadge kind="job" status={item.status} /><PriorityBadge priority={request?.priority} /></>}
              lines={[
                { icon: 'account-outline', text: customerName },
                { icon: 'ferry', text: vessel },
                { icon: 'map-marker-outline', text: request?.location_text || '' },
                { icon: 'clock-outline', text: when },
              ]}
              actionLabel="View job"
              onPress={() => router.push(`/(technician)/job/${item.id}`)}
            />
          );
        }}
      />
    </Screen>
  );
}
