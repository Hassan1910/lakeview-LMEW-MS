import React from 'react';
import { FlatList } from 'react-native';
import { List } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../src/lib/db';
import { ScreenBody } from '../../src/components/ScreenBody';

export default function TechniciansScreen() {
  const query = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => {
      const { data, error } = await db().from('profiles').select('id, full_name, phone, is_active').eq('role', 'technician');
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!query.data?.length} emptyLabel="No technicians.">
      <FlatList data={query.data} keyExtractor={(item) => item.id} renderItem={({ item }) => <List.Item title={item.full_name} description={`${item.phone ?? ''} · ${item.is_active ? 'active' : 'disabled'}`} />} />
    </ScreenBody>
  );
}
