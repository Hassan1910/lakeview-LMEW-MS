import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { Link } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../../src/store/authStore';
import { db, myCustomerId, watchTable } from '../../src/lib/db';
import { ScreenBody } from '../../src/components/ScreenBody';
import { StatusStepper } from '../../src/components/StatusStepper';
import { serviceStatusConfig } from '@lmew/ui-tokens';

export default function CustomerHome() {
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const customer = useQuery({
    queryKey: ['my-customer', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: () => myCustomerId(profile!.id),
  });
  const requests = useQuery({
    queryKey: ['my-requests', customer.data],
    enabled: Boolean(customer.data),
    queryFn: async () => {
      const { data, error } = await db()
        .from('service_requests')
        .select('id, code, title, status, vessel:vessels(name)')
        .eq('customer_id', customer.data!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      await AsyncStorage.setItem('lmew.requests.cache', JSON.stringify(data));
      return data ?? [];
    },
  });
  const notes = useQuery({
    queryKey: ['notifications', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await db().from('notifications').select('id, title, body, read_at').eq('user_id', profile!.id).order('created_at', { ascending: false }).limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!profile?.id) return;
    const stopNotes = watchTable('notifications', () => queryClient.invalidateQueries({ queryKey: ['notifications', profile.id] }), `user_id=eq.${profile.id}`);
    const stopRequests = watchTable('service_requests', () => queryClient.invalidateQueries({ queryKey: ['my-requests'] }));
    return () => { stopNotes(); stopRequests(); };
  }, [profile?.id, queryClient]);

  const open = (requests.data ?? []).filter((row) => !['completed', 'cancelled'].includes(row.status));
  const active = open[0];
  const label = active ? serviceStatusConfig[active.status as keyof typeof serviceStatusConfig]?.label : null;

  return (
    <ScreenBody
      loading={customer.isLoading || requests.isLoading}
      error={requests.error instanceof Error ? requests.error.message : null}
      onRetry={() => requests.refetch()}
      empty={!requests.data?.length}
      emptyLabel="No service requests yet."
    >
      <ScrollView contentContainerStyle={styles.pad}>
        <Text variant="titleMedium">Hello {profile?.full_name}</Text>
        {active ? (
          <Card style={styles.card}>
            <Card.Title title={active.title} subtitle={`${active.code ?? ''} · ${label ?? active.status}`} />
            <Card.Content><StatusStepper status={active.status} /></Card.Content>
            <Card.Actions>
              <Link href={`/(customer)/request/${active.id}`} asChild><Button>Track</Button></Link>
            </Card.Actions>
          </Card>
        ) : null}
        <View style={styles.row}>
          <Link href="/(customer)/new-request" asChild><Button mode="contained">New request</Button></Link>
          <Link href="/(customer)/invoices" asChild><Button mode="outlined">Pay</Button></Link>
          <Link href="/(customer)/search" asChild><Button mode="outlined">Search</Button></Link>
        </View>
        <Text variant="titleSmall">Recommended services</Text>
        <View style={styles.row}>
          {['engine_maintenance', 'boat_repair', 'electrical', 'welding'].map((category) => (
            <Link key={category} href={`/(customer)/search`} asChild><Button mode="outlined">{category.replace('_', ' ')}</Button></Link>
          ))}
        </View>
        <Text variant="titleSmall">Recent notifications</Text>
        {(notes.data ?? []).map((note) => (
          <Text key={note.id}>{note.title}{note.read_at ? '' : ' · new'}</Text>
        ))}
        {!notes.data?.length ? <Text>No notifications.</Text> : null}
        <Link href="/(customer)/notifications">See all notifications</Link>
      </ScrollView>
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
