import React, { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, List, Text, TextInput } from 'react-native-paper';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../../../src/store/authStore';
import { db } from '../../../../src/lib/db';

export default function JobParts() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useAuthStore((s) => s.profile);
  const [qty, setQty] = useState('1');
  const [picked, setPicked] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const issued = useQuery({
    queryKey: ['job-parts', id],
    queryFn: async () => {
      const { data, error: queryError } = await db().from('work_order_parts').select('id, quantity, inventory_item_id').eq('work_order_id', id);
      if (queryError) throw queryError;
      return data ?? [];
    },
  });
  const items = useQuery({
    queryKey: ['parts-catalog'],
    queryFn: async () => {
      const { data, error: queryError } = await db().from('inventory_items').select('id, sku, name, quantity_on_hand').eq('is_active', true).order('name');
      if (queryError) throw queryError;
      return data ?? [];
    },
  });

  const request = async () => {
    const quantity = Number(qty);
    if (!profile || !picked) return setError('Choose a part');
    if (!Number.isFinite(quantity) || quantity <= 0) return setError('Quantity must be greater than zero');
    const { error: insertError } = await db().from('work_order_parts').insert({
      work_order_id: id,
      inventory_item_id: picked,
      quantity,
      requested_by: profile.id,
    });
    if (insertError) setError(insertError.message);
    else {
      setMessage('Part issued and stock reduced');
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['job-parts', id] });
    }
  };

  return (
    <View style={styles.pad}>
      <TextInput label="Quantity" value={qty} onChangeText={setQty} mode="outlined" keyboardType="decimal-pad" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.ok}>{message}</Text> : null}
      <Text variant="titleSmall">Already issued</Text>
      {(issued.data ?? []).length === 0 ? <Text>No parts requested yet.</Text> : issued.data?.map((part) => <Text key={part.id}>{part.quantity} · {part.inventory_item_id}</Text>)}
      <Button mode="contained" onPress={request}>Request part</Button>
      <FlatList
        data={items.data}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text>{items.isLoading ? 'Loading parts…' : 'No parts in stock.'}</Text>}
        renderItem={({ item }) => (
          <List.Item title={item.name} description={`${item.sku} · on hand ${item.quantity_on_hand}`} onPress={() => setPicked(item.id)} style={picked === item.id ? styles.picked : undefined} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({ pad: { flex: 1, padding: 16, gap: 8 }, error: { color: '#EF4444' }, ok: { color: '#22C55E' }, picked: { backgroundColor: '#E0F2FE' } });
