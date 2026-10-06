import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../../src/store/authStore';
import { db } from '../../../../src/lib/db';
import { ScreenBody } from '../../../../src/components/ScreenBody';

const kinds = ['before', 'after', 'progress', 'document'] as const;

export default function JobMedia() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<(typeof kinds)[number]>('progress');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const existing = useQuery({
    queryKey: ['job-media', id],
    queryFn: async () => {
      const { data, error: queryError } = await db().from('work_order_media').select('id, kind, storage_path').eq('work_order_id', id);
      if (queryError) throw queryError;
      return Promise.all((data ?? []).map(async (item) => {
        const signed = await db().storage.from('work-order-media').createSignedUrl(item.storage_path, 3600);
        return { ...item, url: signed.data?.signedUrl ?? null };
      }));
    },
  });

  const upload = async () => {
    if (!profile) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (result.canceled) return;
    const asset = result.assets[0];
    const path = `${id}/${kind}-${Date.now()}.jpg`;
    const bytes = await (await fetch(asset.uri)).arrayBuffer();
    const stored = await db().storage.from('work-order-media').upload(path, bytes, { contentType: 'image/jpeg' });
    if (stored.error) return setError(stored.error.message);
    const { error: insertError } = await db().from('work_order_media').insert({ work_order_id: id, storage_path: path, kind, uploaded_by: profile.id });
    if (insertError) setError(insertError.message);
    else {
      setMessage('Photo uploaded');
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['job-media', id] });
    }
  };

  return (
    <ScreenBody loading={existing.isLoading} error={existing.error instanceof Error ? existing.error.message : error}>
      <ScrollView contentContainerStyle={styles.pad}>
        {kinds.map((item) => <Button key={item} mode={kind === item ? 'contained' : 'text'} onPress={() => setKind(item)}>{item}</Button>)}
        <Button mode="contained" onPress={upload}>Upload {kind} photo</Button>
        {message ? <Text style={styles.ok}>{message}</Text> : null}
        {!existing.data?.length ? <Text>No photos yet.</Text> : null}
        {(existing.data ?? []).map((item) => (
          <View key={item.id}>
            <Text>{item.kind}</Text>
            {item.url ? <Image source={{ uri: item.url }} style={styles.photo} /> : null}
          </View>
        ))}
      </ScrollView>
    </ScreenBody>
  );
}

const styles = StyleSheet.create({ pad: { padding: 16, gap: 8 }, ok: { color: '#22C55E' }, photo: { width: '100%', height: 180, borderRadius: 8 } });
