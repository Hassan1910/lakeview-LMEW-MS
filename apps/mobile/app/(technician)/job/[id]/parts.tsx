import React, { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, List, Text, TextInput } from 'react-native-paper';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../../../src/store/authStore';
import { db } from '../../../../src/lib/db';
import { Notice, Screen } from '../../../../src/components/ui';
import { friendlyError, one } from '../../../../src/lib/format';
import { palette, ui } from '../../../../src/theme';

export default function JobParts() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useAuthStore((s) => s.profile);
  const [qty, setQty] = useState('1');
  const [picked, setPicked] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const issued = useQuery({
    queryKey: ['job-parts', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error: queryError } = await db().from('work_order_parts').select('id, quantity, inventory_item:inventory_items(name, sku)').eq('work_order_id', id);
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
    const item = items.data?.find((row) => row.id === picked);
    if (!profile || !picked || !item) return setError('Choose a part');
    if (!Number.isFinite(quantity) || quantity <= 0) return setError('Quantity must be greater than zero');
    if (quantity > Number(item.quantity_on_hand)) return setError(`Only ${item.quantity_on_hand} ${item.name} on hand`);
    setSaving(true);
    setError(null);
    const { error: insertError } = await db().from('work_order_parts').insert({
      work_order_id: id,
      inventory_item_id: picked,
      quantity,
      requested_by: profile.id,
    });
    setSaving(false);
    if (insertError) setError(friendlyError(insertError.message));
    else {
      setMessage(`${item.name} issued and stock reduced`);
      setPicked(null);
      queryClient.invalidateQueries({ queryKey: ['job-parts', id] });
      queryClient.invalidateQueries({ queryKey: ['parts-catalog'] });
    }
  };

  return (
    <Screen>
      <FlatList
        data={items.data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={ui.pad}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 8, marginBottom: 8 }}>
            <TextInput label="Quantity" value={qty} onChangeText={setQty} mode="outlined" keyboardType="decimal-pad" />
            {error ? <Notice tone="error" text={error} /> : null}
            {message ? <Notice tone="ok" text={message} /> : null}
            {issued.error ? <Notice tone="error" text={friendlyError(issued.error)} /> : null}
            <Text style={ui.section}>Already issued</Text>
            {(issued.data ?? []).length === 0 ? <Text style={ui.muted}>No parts issued yet.</Text> : null}
            {(issued.data ?? []).map((part) => {
              const item = one(part.inventory_item);
              return <Text key={part.id} style={ui.body}>{part.quantity} · {item?.name ?? 'Part'}{item?.sku ? ` (${item.sku})` : ''}</Text>;
            })}
            <Button mode="contained" loading={saving} disabled={saving} onPress={request}>Request part</Button>
            <Text style={ui.section}>In stock</Text>
            {items.error ? <Notice tone="error" text={friendlyError(items.error)} /> : null}
          </View>
        }
        ListEmptyComponent={<Text style={ui.muted}>{items.isLoading ? 'Loading parts…' : 'No parts in stock.'}</Text>}
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            description={`${item.sku} · on hand ${item.quantity_on_hand}`}
            onPress={() => setPicked(item.id)}
            style={{ backgroundColor: picked === item.id ? '#E0F2FE' : palette.surface, borderRadius: 12, marginBottom: 8 }}
          />
        )}
      />
    </Screen>
  );
}
