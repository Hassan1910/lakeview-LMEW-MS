import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, List, Text, TextInput } from 'react-native-paper';
import { Link, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { db, myCustomerId } from '../../src/lib/db';
import { Choice, Notice, Screen } from '../../src/components/ui';
import { friendlyError, labelize } from '../../src/lib/format';
import { routeForSearchHit } from '../../src/lib/routes';
import { ui } from '../../src/theme';

const categories = ['boat_repair', 'ship_repair', 'engine_maintenance', 'fabrication', 'electrical', 'welding', 'equipment_supply', 'consultation', 'other'];

type Row = { id: string; title: string; subtitle: string; href: string | null };

export default function SearchScreen() {
  const profile = useAuthStore((s) => s.profile);
  const params = useLocalSearchParams<{ category?: string }>();
  const [term, setTerm] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const runCategory = async (category: string) => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    setActiveCategory(category);
    const customerId = await myCustomerId(profile.id);
    const { data, error: queryError } = await db()
      .from('service_requests')
      .select('id, code, title, category')
      .eq('customer_id', customerId)
      .eq('category', category);
    setLoading(false);
    setSearched(true);
    if (queryError) setError(friendlyError(queryError.message));
    else setRows((data ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: [item.code, labelize(item.category)].filter(Boolean).join(' · '),
      href: routeForSearchHit('service_request', item.id),
    })));
  };

  const run = async () => {
    if (!profile) return;
    const q = term.trim();
    if (q.length < 2) {
      setError('Enter at least 2 characters');
      return;
    }
    setLoading(true);
    setError(null);
    setActiveCategory(null);
    const { data, error: queryError } = await db().rpc('search_catalog', { q });
    setLoading(false);
    setSearched(true);
    if (queryError) {
      setError(friendlyError(queryError.message));
      return;
    }
    const hits = (data ?? []) as { kind: string; id: string; title: string; subtitle: string }[];
    setRows(hits.map((hit) => ({
      id: `${hit.kind}-${hit.id}`,
      title: hit.title,
      subtitle: `${labelize(hit.kind)} · ${hit.subtitle}`,
      href: routeForSearchHit(hit.kind, hit.id),
    })));
  };

  useEffect(() => {
    if (profile?.id && params.category && categories.includes(params.category)) void runCategory(params.category);
    // Category comes from the home-screen shortcut. Re-run only when that value or the signed-in user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.category, profile?.id]);

  return (
    <Screen>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={ui.pad}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 8 }}>
            <TextInput label="Code or title" value={term} onChangeText={setTerm} mode="outlined" onSubmitEditing={() => run()} />
            <Button mode="contained" loading={loading} disabled={loading} onPress={() => run()}>Search</Button>
            <Text style={ui.section}>Your requests by service</Text>
            <View style={ui.row}>
              {categories.map((category) => (
                <Choice key={category} label={labelize(category)} selected={activeCategory === category} onPress={() => runCategory(category)} />
              ))}
            </View>
            {error ? <Notice tone="error" text={error} /> : null}
          </View>
        }
        ListEmptyComponent={searched && !loading ? <Text style={ui.muted}>No matches.</Text> : null}
        renderItem={({ item }) => {
          const row = <List.Item title={item.title} description={item.subtitle} style={{ backgroundColor: '#fff', borderRadius: 12, marginBottom: 8 }} />;
          if (!item.href) return row;
          return <Link href={item.href as `/(customer)/request/${string}`} asChild>{row}</Link>;
        }}
      />
    </Screen>
  );
}
