import React, { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, List, Text, TextInput } from 'react-native-paper';
import { Link } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { VesselCreateSchema } from '@lmew/shared-types';
import { useAuthStore } from '../../src/store/authStore';
import { db, myCustomerId } from '../../src/lib/db';
import { ScreenBody } from '../../src/components/ScreenBody';

export default function VesselsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [registration, setRegistration] = useState('');
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['vessels', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const customerId = await myCustomerId(profile!.id);
      const { data, error } = await db().from('vessels').select('id, name, registration_no, type').eq('customer_id', customerId ?? '');
      if (error) throw error;
      return { customerId, rows: data ?? [] };
    },
  });
  const add = async () => {
    const parsed = VesselCreateSchema.safeParse({ name, registration_no: registration });
    if (!parsed.success || !query.data?.customerId) return setError(parsed.success ? 'Customer record missing' : parsed.error.issues[0]?.message ?? 'Invalid');
    const { error: insertError } = await db().from('vessels').insert({ ...parsed.data, customer_id: query.data.customerId });
    if (insertError) setError(insertError.message);
    else { setError(null); setName(''); setRegistration(''); queryClient.invalidateQueries({ queryKey: ['vessels'] }); }
  };
  return (
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} onRetry={() => query.refetch()}>
      <FlatList
        data={query.data?.rows ?? []}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.pad}>No vessels yet. Add one below.</Text>}
        renderItem={({ item }) => (
          <Link href={`/(customer)/vessel/${item.id}`} asChild>
            <List.Item title={item.name} description={item.registration_no ?? item.type ?? ''} />
          </Link>
        )}
        ListFooterComponent={
          <View style={styles.pad}>
            <TextInput label="Name" value={name} onChangeText={setName} mode="outlined" />
            <TextInput label="Registration" value={registration} onChangeText={setRegistration} mode="outlined" />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button mode="contained" onPress={add}>Add vessel</Button>
          </View>
        }
      />
    </ScreenBody>
  );
}

const styles = StyleSheet.create({ pad: { padding: 16, gap: 8 }, error: { color: '#EF4444' } });
