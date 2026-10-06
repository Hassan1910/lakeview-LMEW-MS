import React from 'react';
import { FlatList } from 'react-native';
import { List } from 'react-native-paper';
import { Link } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../src/store/authStore';
import { db, myCustomerId } from '../../src/lib/db';
import { ScreenBody } from '../../src/components/ScreenBody';

export default function InvoicesScreen() {
  const profile = useAuthStore((s) => s.profile);
  const query = useQuery({
    queryKey: ['my-invoices', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const customerId = await myCustomerId(profile!.id);
      const { data, error } = await db().from('invoices').select('id, code, status, total, balance, currency').eq('customer_id', customerId ?? '').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!query.data?.length} emptyLabel="No invoices yet." onRetry={() => query.refetch()}>
      <FlatList
        data={query.data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Link href={`/(customer)/invoice/${item.id}`} asChild>
            <List.Item title={item.code ?? 'Invoice'} description={`${item.status} · balance ${item.balance ?? item.total} ${item.currency}`} />
          </Link>
        )}
      />
    </ScreenBody>
  );
}
