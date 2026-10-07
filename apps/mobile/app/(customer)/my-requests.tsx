import React, { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../src/store/authStore';
import { db, myCustomerId } from '../../src/lib/db';
import { Screen } from '../../src/components/ui';
import { SegmentedControl } from '../../src/components/SegmentedControl';
import { RecordCard } from '../../src/components/RecordCard';
import { EmptyState } from '../../src/components/EmptyState';
import { SkeletonList } from '../../src/components/Skeleton';
import { StatusBadge } from '../../src/components/StatusBadge';
import { formatWhen, friendlyError, labelize, one, requestBucket } from '../../src/lib/format';
import { useRefreshOnFocus } from '../../src/lib/focus';
import { palette, ui } from '../../src/theme';

const filters = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

type Filter = (typeof filters)[number]['value'];

const emptyCopy: Record<Filter, { title: string; message: string }> = {
  all: { title: 'No requests yet', message: 'Start one when a vessel needs work.' },
  pending: { title: 'No pending requests', message: 'New and waiting requests will show here.' },
  in_progress: { title: 'Nothing in progress', message: 'Repairs that are underway will show here.' },
  completed: { title: 'No completed requests', message: 'Finished work will show here.' },
  cancelled: { title: 'No cancelled requests', message: 'Cancelled requests will show here.' },
};

export default function MyRequests() {
  const profile = useAuthStore((s) => s.profile);
  const [filter, setFilter] = useState<Filter>('all');
  const query = useQuery({
    queryKey: ['my-requests-list', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const customerId = await myCustomerId(profile!.id);
      const { data, error } = await db()
        .from('service_requests')
        .select('id, code, title, status, category, created_at, location_text, work_orders(status, assignee:profiles!assigned_to(full_name))')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  useRefreshOnFocus(() => { if (profile?.id) void query.refetch(); });

  const rows = query.data ?? [];
  const visible = filter === 'all' ? rows : rows.filter((row) => requestBucket(row.status) === filter);
  const copy = emptyCopy[filter];

  return (
    <Screen>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={palette.primary} />}
        contentContainerStyle={[ui.pad, visible.length === 0 ? { flexGrow: 1 } : null]}
        ListHeaderComponent={
          <View style={{ marginBottom: 12 }}>
            <SegmentedControl options={filters.map((item) => ({ value: item.value, label: item.label }))} value={filter} onChange={setFilter} />
          </View>
        }
        ListEmptyComponent={
          query.isLoading ? <SkeletonList count={3} />
            : query.error ? (
              <EmptyState
                icon="alert-circle-outline"
                title="Requests could not be loaded"
                message={friendlyError(query.error)}
                actionLabel="Try again"
                onAction={() => query.refetch()}
              />
            ) : (
              <EmptyState
                icon="clipboard-text-outline"
                title={copy.title}
                message={copy.message}
                actionLabel={rows.length === 0 ? 'New request' : undefined}
                onAction={rows.length === 0 ? () => router.push('/(customer)/new-request') : undefined}
              />
            )
        }
        renderItem={({ item }) => {
          const orders = Array.isArray(item.work_orders) ? item.work_orders : [];
          const current = orders.find((order) => order.status !== 'cancelled' && order.status !== 'completed') ?? orders[0];
          const technician = one(current?.assignee)?.full_name ?? '';
          return (
            <RecordCard
              title={item.title}
              subtitle={item.code}
              badges={<StatusBadge kind="service" status={item.status} />}
              lines={[
                { icon: 'wrench', text: item.category ? labelize(item.category) : '' },
                { icon: 'clock-outline', text: item.created_at ? formatWhen(item.created_at) : '' },
                { icon: 'map-marker-outline', text: item.location_text || '' },
                { icon: 'account-hard-hat', text: technician ? `Technician · ${technician}` : '' },
              ]}
              actionLabel="View request"
              onPress={() => router.push(`/(customer)/request/${item.id}`)}
            />
          );
        }}
      />
    </Screen>
  );
}
