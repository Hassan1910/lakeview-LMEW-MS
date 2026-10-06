import React from 'react';
import { Button, Text } from 'react-native-paper';
import { Link } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../src/store/authStore';
import { db } from '../../src/lib/db';
import { ScreenBody } from '../../src/components/ScreenBody';
import { Page } from '../../src/components/ui';
import { useRefreshOnFocus } from '../../src/lib/focus';
import { ui } from '../../src/theme';

export default function TechnicianHome() {
  const profile = useAuthStore((s) => s.profile);
  const query = useQuery({
    queryKey: ['tech-count', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { count, error } = await db().from('work_orders').select('id', { count: 'exact', head: true }).eq('assigned_to', profile!.id).neq('status', 'completed').neq('status', 'cancelled');
      if (error) throw error;
      return count ?? 0;
    },
  });
  useRefreshOnFocus(() => { if (profile?.id) void query.refetch(); });
  return (
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} onRetry={() => query.refetch()}>
      <Page>
        <Text style={ui.title}>{profile?.full_name}</Text>
        <Text style={ui.body}>{query.data ?? 0} open jobs</Text>
        {query.data === 0 ? <Text style={ui.muted}>No open jobs. You are clear.</Text> : null}
        <Link href="/(technician)/my-jobs" asChild><Button mode="contained">Open job list</Button></Link>
        <Link href="/(technician)/notifications" asChild><Button mode="outlined">Notifications</Button></Link>
      </Page>
    </ScreenBody>
  );
}
