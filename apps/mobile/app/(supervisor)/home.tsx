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

export default function SupervisorHome() {
  const profile = useAuthStore((s) => s.profile);
  const query = useQuery({
    queryKey: ['team-open', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await db().from('work_orders').select('id, status');
      if (error) throw error;
      const rows = data ?? [];
      return {
        total: rows.length,
        open: rows.filter((row) => !['completed', 'cancelled'].includes(row.status)).length,
      };
    },
  });
  useRefreshOnFocus(() => { if (profile?.id) void query.refetch(); });
  return (
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} onRetry={() => query.refetch()}>
      <Page>
        <Text style={ui.title}>{profile?.full_name}</Text>
        <Text style={ui.body}>{query.data?.open ?? 0} open · {query.data?.total ?? 0} jobs you can see</Text>
        {query.data?.total === 0 ? <Text style={ui.muted}>No team jobs yet.</Text> : null}
        <Link href="/(supervisor)/team-jobs" asChild><Button mode="contained">Team jobs</Button></Link>
        <Link href="/(supervisor)/technicians" asChild><Button mode="outlined">Technicians</Button></Link>
        <Link href="/(supervisor)/reports" asChild><Button mode="outlined">Performance</Button></Link>
      </Page>
    </ScreenBody>
  );
}
