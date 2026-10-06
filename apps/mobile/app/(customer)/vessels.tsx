import React, { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, List, Text, TextInput } from 'react-native-paper';
import { Link } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { VesselCreateSchema } from '@lmew/shared-types';
import { useAuthStore } from '../../src/store/authStore';
import { db, myCustomerId } from '../../src/lib/db';
import { ScreenBody } from '../../src/components/ScreenBody';
import { Notice } from '../../src/components/ui';
import { friendlyError, labelize } from '../../src/lib/format';
import { ui } from '../../src/theme';

export default function VesselsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [registration, setRegistration] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const query = useQuery({
    queryKey: ['vessels', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const customerId = await myCustomerId(profile!.id);
      const { data, error: queryError } = await db().from('vessels').select('id, name, registration_no, type').eq('customer_id', customerId);
      if (queryError) throw queryError;
      return { customerId, rows: data ?? [] };
    },
  });
  const add = async () => {
    const parsed = VesselCreateSchema.safeParse({ name: name.trim(), registration_no: registration.trim() });
    if (!parsed.success || !query.data?.customerId) return setError(parsed.success ? 'Customer record missing' : parsed.error.issues[0]?.message ?? 'Invalid');
    setSaving(true);
    const { error: insertError } = await db().from('vessels').insert({ ...parsed.data, customer_id: query.data.customerId });
    setSaving(false);
    if (insertError) setError(friendlyError(insertError.message));
    else {
      setError(null);
      setName('');
      setRegistration('');
      queryClient.invalidateQueries({ queryKey: ['vessels'] });
    }
  };
  return (
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} onRetry={() => query.refetch()}>
      <FlatList
        data={query.data?.rows ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={ui.pad}
        ListEmptyComponent={<Text style={ui.muted}>No vessels yet. Add the boat this work is for.</Text>}
        renderItem={({ item }) => (
          <Link href={`/(customer)/vessel/${item.id}`} asChild>
            <List.Item title={item.name} description={[item.registration_no, item.type ? labelize(item.type) : null].filter(Boolean).join(' · ')} style={{ backgroundColor: '#fff', borderRadius: 12, marginBottom: 8 }} />
          </Link>
        )}
        ListFooterComponent={
          <View style={{ gap: 8, marginTop: 8 }}>
            <Text style={ui.section}>Add a vessel</Text>
            <TextInput label="Name" value={name} onChangeText={setName} mode="outlined" />
            <TextInput label="Registration" value={registration} onChangeText={setRegistration} mode="outlined" />
            {error ? <Notice tone="error" text={error} /> : null}
            <Button mode="contained" loading={saving} disabled={saving} onPress={add}>Add vessel</Button>
          </View>
        }
      />
    </ScreenBody>
  );
}
