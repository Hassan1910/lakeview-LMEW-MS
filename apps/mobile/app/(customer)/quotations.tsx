import React from 'react';
import { FlatList } from 'react-native';
import { List } from 'react-native-paper';
import { Link } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../src/store/authStore';
import { db, myCustomerId } from '../../src/lib/db';
import { ScreenBody } from '../../src/components/ScreenBody';
import { labelize, money } from '../../src/lib/format';
import { useRefreshOnFocus } from '../../src/lib/focus';

export default function QuotationsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const query = useQuery({
    queryKey: ['my-quotes', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const customerId = await myCustomerId(profile!.id);
      const { data: requests, error } = await db().from('service_requests').select('id').eq('customer_id', customerId);
      if (error) throw error;
      const ids = (requests ?? []).map((row) => row.id);
      if (!ids.length) return [];
      const quotes = await db().from('quotations').select('id, code, status, total, currency, service_request_id').in('service_request_id', ids).order('created_at', { ascending: false });
      if (quotes.error) throw quotes.error;
      return quotes.data ?? [];
    },
  });
  useRefreshOnFocus(() => { if (profile?.id) void query.refetch(); });
  return (
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!query.data?.length} emptyLabel="No quotations yet. They appear here when the yard sends one." onRetry={() => query.refetch()}>
      <FlatList
        data={query.data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Link href={`/(customer)/request/${item.service_request_id}`} asChild>
            <List.Item title={item.code ?? 'Quotation'} description={`${labelize(item.status)} · ${money(item.total, item.currency)}`} style={{ backgroundColor: '#fff' }} />
          </Link>
        )}
      />
    </ScreenBody>
  );
}
