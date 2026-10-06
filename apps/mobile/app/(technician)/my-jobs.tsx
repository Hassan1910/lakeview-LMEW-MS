import React, { useEffect, useState } from 'react';
import { FlatList } from 'react-native';
import { Button, List } from 'react-native-paper';
import { Link } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../src/store/authStore';
import { db, watchTable } from '../../src/lib/db';
import { ScreenBody } from '../../src/components/ScreenBody';

const tabs = ['assigned', 'in_progress', 'completed'] as const;

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
        .eq('status', tab);
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => {
    if (!profile?.id) return;
    return watchTable('work_orders', () => queryClient.invalidateQueries({ queryKey: ['jobs', profile.id] }), `assigned_to=eq.${profile.id}`);
  }, [profile?.id, queryClient]);

  return (
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!query.data?.length} emptyLabel={`No ${tab.replace('_', ' ')} jobs.`} onRetry={() => query.refetch()}>
      <FlatList
        data={query.data}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<>{tabs.map((item) => <Button key={item} mode={tab === item ? 'contained' : 'text'} onPress={() => setTab(item)}>{item}</Button>)}</>}
        renderItem={({ item }) => {
          const request = Array.isArray(item.service_request) ? item.service_request[0] : item.service_request;
          const customer = request && (Array.isArray(request.customer) ? request.customer[0] : request.customer);
          const vessel = request && (Array.isArray(request.vessel) ? request.vessel[0] : request.vessel);
          return (
          <Link href={`/(technician)/job/${item.id}`} asChild>
            <List.Item title={item.code ?? request?.title} description={`${customer?.company_name ?? ''} · ${vessel?.name ?? ''} · ${request?.priority ?? ''} · ${item.scheduled_start ?? 'unscheduled'}`} />
          </Link>
          );
        }}
      />
    </ScreenBody>
  );
}
