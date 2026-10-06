import React, { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, List, Text, TextInput } from 'react-native-paper';
import { Link } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { db, myCustomerId } from '../../src/lib/db';

const categories = ['boat_repair', 'ship_repair', 'engine_maintenance', 'fabrication', 'electrical', 'welding', 'equipment_supply', 'consultation', 'other'];

export default function SearchScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [term, setTerm] = useState('');
  const [rows, setRows] = useState<{ id: string; title: string; subtitle: string; href: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runCategory = async (category: string) => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    const customerId = await myCustomerId(profile.id);
    const { data, error: queryError } = await db()
      .from('service_requests')
      .select('id, code, title, category')
      .eq('customer_id', customerId ?? '')
      .eq('category', category);
    setLoading(false);
    setSearched(true);
    if (queryError) setError(queryError.message);
    else setRows((data ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: `${item.code ?? ''} · ${item.category}`,
      href: `/(customer)/request/${item.id}`,
    })));
  };

  const run = async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await db().rpc('search_catalog', { q: term.trim() });
    setLoading(false);
    setSearched(true);
    if (queryError) {
      setError(queryError.message);
      return;
    }
    const hits = (data ?? []) as { kind: string; id: string; title: string; subtitle: string }[];
    setRows(hits.map((hit) => ({
      id: `${hit.kind}-${hit.id}`,
      title: hit.title,
      subtitle: `${hit.kind} · ${hit.subtitle}`,
      href: hit.kind === 'service_request' ? `/(customer)/request/${hit.id}` : '/(customer)/search',
    })));
  };

  return (
    <View style={styles.pad}>
      <TextInput label="Code or title" value={term} onChangeText={setTerm} mode="outlined" />
      <Button mode="contained" loading={loading} onPress={() => run()}>Search</Button>
      <Text>Services</Text>
      {categories.map((category) => <Button key={category} onPress={() => runCategory(category)}>{category}</Button>)}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={searched ? <Text>No matches.</Text> : null}
        renderItem={({ item }) => {
          const row = <List.Item title={item.title} description={item.subtitle} />;
          if (!item.href.includes('/request/')) return row;
          return (
            <Link href={item.href as `/(customer)/request/${string}`} asChild>
              {row}
            </Link>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ pad: { flex: 1, padding: 16, gap: 8 }, error: { color: '#EF4444' } });
