import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { Button, List, Text } from 'react-native-paper';
import { Link } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../src/store/authStore';
import { db, watchTable } from '../../src/lib/db';
import { Choice, Notice, Screen } from '../../src/components/ui';
import { friendlyError, labelize, one } from '../../src/lib/format';
import { useRefreshOnFocus } from '../../src/lib/focus';
import { palette, ui } from '../../src/theme';

const tabs = ['assigned', 'in_progress', 'blocked', 'completed', 'cancelled'] as const;

export default function MyJobs() {
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<(typeof tabs)[number]>('assigned');
  const query = useQuery({
    queryKey: ['jobs', profile?.id, tab],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await db()
        .from('work_orders')
        .select('id, code, status, scheduled_start, service_request:service_requests(title, priority, vessel:vessels(name), customer:customers(company_name))')
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

  const filters = (
    <View style={[ui.row, { marginBottom: 12 }]}>
      {tabs.map((item) => <Choice key={item} label={labelize(item)} selected={tab === item} onPress={() => setTab(item)} />)}
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={query.data ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={palette.primary} />}
        contentContainerStyle={ui.pad}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            {filters}
            {query.isLoading ? <ActivityIndicator color={palette.primary} /> : null}
            {query.error instanceof Error ? (
              <View style={{ gap: 8 }}>
                <Notice tone="error" text={friendlyError(query.error)} />
                <Button mode="contained" onPress={() => query.refetch()}>Try again</Button>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={query.isLoading || query.error ? null : <Text style={ui.muted}>No {labelize(tab).toLowerCase()} jobs.</Text>}
        renderItem={({ item }) => {
          const request = one(item.service_request);
          const customer = one(request?.customer);
          const vessel = one(request?.vessel);
          return (
            <Link href={`/(technician)/job/${item.id}`} asChild>
              <List.Item
                title={item.code ?? request?.title ?? 'Job'}
                description={[customer?.company_name, vessel?.name, request?.priority ? labelize(request.priority) : null, item.scheduled_start ?? 'Unscheduled'].filter(Boolean).join(' · ')}
                style={{ backgroundColor: '#fff', borderRadius: 12, marginBottom: 8 }}
              />
            </Link>
          );
        }}
      />
    </Screen>
  );
}
