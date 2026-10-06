import React from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { Link } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../src/store/authStore';
import { db } from '../../src/lib/db';

export default function SupervisorHome() {
  const profile = useAuthStore((s) => s.profile);
  const query = useQuery({
    queryKey: ['team-open', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await db().from('work_orders').select('id, status').eq('supervisor_id', profile!.id);
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text variant="titleMedium">{profile?.full_name}</Text>
      <Text>{query.isLoading ? 'Loading…' : query.error instanceof Error ? query.error.message : `${query.data?.length ?? 0} jobs in view`}</Text>
      {!query.data?.length && !query.isLoading ? <Text>No team jobs yet.</Text> : null}
      <Link href="/(supervisor)/team-jobs" asChild><Button mode="contained">Team jobs</Button></Link>
      <Link href="/(supervisor)/technicians" asChild><Button>Technicians</Button></Link>
      <Link href="/(supervisor)/reports" asChild><Button>Performance</Button></Link>
    </View>
  );
}
