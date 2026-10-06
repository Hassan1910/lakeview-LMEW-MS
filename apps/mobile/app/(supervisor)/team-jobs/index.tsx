import React from 'react';
import { FlatList } from 'react-native';
import { List } from 'react-native-paper';
import { Link } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../../src/lib/db';
import { ScreenBody } from '../../../src/components/ScreenBody';

export default function TeamJobs() {
  const query = useQuery({
    queryKey: ['team-jobs'],
    queryFn: async () => {
      const { data, error } = await db().from('work_orders').select('id, code, status, assigned_to, technician:profiles!work_orders_assigned_to_fkey(full_name)').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!query.data?.length} emptyLabel="No team jobs.">
      <FlatList data={query.data} keyExtractor={(item) => item.id} renderItem={({ item }) => {
        const technician = Array.isArray(item.technician) ? item.technician[0] : item.technician;
        return (
        <Link href={`/(supervisor)/team-jobs/${item.id}`} asChild>
          <List.Item title={item.code ?? item.id} description={`${item.status} · ${technician?.full_name ?? 'Unassigned'}`} />
        </Link>
        );
      }} />
    </ScreenBody>
  );
}
