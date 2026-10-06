import React from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { List } from 'react-native-paper';
import { Link } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../src/store/authStore';
import { db, myCustomerId } from '../../src/lib/db';
import { ScreenBody } from '../../src/components/ScreenBody';
import { labelize } from '../../src/lib/format';
import { useRefreshOnFocus } from '../../src/lib/focus';
import { serviceStatusConfig } from '@lmew/ui-tokens';
import { palette } from '../../src/theme';

export default function MyRequests() {
  const profile = useAuthStore((s) => s.profile);
  const query = useQuery({
    queryKey: ['my-requests-list', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const customerId = await myCustomerId(profile!.id);
      const { data, error } = await db().from('service_requests').select('id, code, title, status').eq('customer_id', customerId).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  useRefreshOnFocus(() => { if (profile?.id) void query.refetch(); });
  return (
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!query.data?.length} emptyLabel="You have no requests yet. Use New to start one." onRetry={() => query.refetch()}>
      <FlatList
        data={query.data}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={palette.primary} />}
        renderItem={({ item }) => (
          <Link href={`/(customer)/request/${item.id}`} asChild>
            <List.Item
              title={item.title}
              description={[item.code, serviceStatusConfig[item.status as keyof typeof serviceStatusConfig]?.label ?? labelize(item.status)].filter(Boolean).join(' · ')}
              style={{ backgroundColor: '#fff' }}
            />
          </Link>
        )}
      />
    </ScreenBody>
  );
}
