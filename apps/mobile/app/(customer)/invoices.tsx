import React from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../src/store/authStore';
import { db, myCustomerId } from '../../src/lib/db';
import { ScreenBody } from '../../src/components/ScreenBody';
import { RecordCard } from '../../src/components/RecordCard';
import { StatusBadge } from '../../src/components/StatusBadge';
import { formatWhen, isPayableStatus, money, one } from '../../src/lib/format';
import { useRefreshOnFocus } from '../../src/lib/focus';
import { palette, ui } from '../../src/theme';

export default function InvoicesScreen() {
  const profile = useAuthStore((s) => s.profile);
  const query = useQuery({
    queryKey: ['my-invoices', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const customerId = await myCustomerId(profile!.id);
      const { data, error } = await db()
        .from('invoices')
        .select('id, code, status, total, balance, currency, due_at, issued_at, created_at, request:service_requests(title)')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  useRefreshOnFocus(() => { if (profile?.id) void query.refetch(); });
  return (
    <ScreenBody
      loading={query.isLoading}
      skeleton={4}
      error={query.error instanceof Error ? query.error.message : null}
      empty={!query.data?.length}
      emptyIcon="receipt"
      emptyTitle="No invoices yet"
      emptyLabel="They show up here after the yard bills a request."
      onRetry={() => query.refetch()}
    >
      <FlatList
        data={query.data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={ui.pad}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={palette.primary} />}
        renderItem={({ item }) => {
          const payable = isPayableStatus(item.status) && Number(item.balance) > 0;
          const request = one(item.request);
          const dated = item.issued_at || item.created_at;
          return (
            <RecordCard
              title={item.code ?? 'Invoice'}
              subtitle={request?.title}
              value={item.status === 'paid' ? money(item.total, item.currency) : money(item.balance, item.currency)}
              badges={<StatusBadge kind="invoice" status={item.status} />}
              lines={[
                { icon: 'calendar-outline', text: item.due_at ? `Due ${formatWhen(item.due_at, 'date')}` : 'No due date' },
                { icon: 'file-document-outline', text: dated ? `Issued ${formatWhen(dated, 'date')}` : '' },
                { icon: 'cash', text: item.status === 'partially_paid' ? 'Partly paid' : '' },
              ]}
              actionLabel={payable ? 'Pay' : 'View invoice'}
              actionQuiet={payable}
              onAction={payable ? () => router.push(`/(customer)/pay/${item.id}`) : undefined}
              onPress={() => router.push(`/(customer)/invoice/${item.id}`)}
            />
          );
        }}
      />
    </ScreenBody>
  );
}
