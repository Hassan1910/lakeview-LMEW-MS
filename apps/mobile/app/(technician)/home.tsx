import React from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { Link } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../src/store/authStore';
import { db } from '../../src/lib/db';

export default function TechnicianHome() {
  const profile = useAuthStore((s) => s.profile);
  const query = useQuery({
    queryKey: ['tech-count', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { count, error } = await db().from('work_orders').select('id', { count: 'exact', head: true }).eq('assigned_to', profile!.id).neq('status', 'completed');
      if (error) throw error;
      return count ?? 0;
    },
  });
  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text variant="titleMedium">{profile?.full_name}</Text>
      <Text>{query.isLoading ? 'Loading jobs…' : query.error instanceof Error ? query.error.message : `${query.data ?? 0} open jobs`}</Text>
      {!query.isLoading && query.data === 0 ? <Text>No open jobs. You are clear.</Text> : null}
      <Link href="/(technician)/my-jobs" asChild><Button mode="contained">Open job list</Button></Link>
      <Link href="/(technician)/notifications" asChild><Button>Notifications</Button></Link>
    </View>
  );
}
