import React, { useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../../src/store/authStore';
import { db } from '../../../../src/lib/db';
import { ScreenBody } from '../../../../src/components/ScreenBody';
import { Choice, Notice } from '../../../../src/components/ui';
import { friendlyError, labelize } from '../../../../src/lib/format';
import { imageUploadBody } from '../../../../src/lib/imageUpload';
import { ui } from '../../../../src/theme';

const kinds = ['before', 'after', 'progress', 'document'] as const;

export default function JobMedia() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<(typeof kinds)[number]>('before');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const existing = useQuery({
    queryKey: ['job-media', id],
    enabled: Boolean(id),
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
    if (!profile || saving) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.8 });
    if (result.canceled) return;
    setSaving(true);
    setError(null);
    const asset = result.assets[0];
    const path = `${id}/${kind}-${Date.now()}.jpg`;
    try {
      const { bytes, contentType } = imageUploadBody(asset);
      const stored = await db().storage.from('work-order-media').upload(path, bytes, { contentType });
      if (stored.error) {
        setSaving(false);
        return setError(friendlyError(stored.error.message));
      }
      const { error: insertError } = await db().from('work_order_media').insert({ work_order_id: id, storage_path: path, kind, uploaded_by: profile.id });
      setSaving(false);
      if (insertError) {
        await db().storage.from('work-order-media').remove([path]);
        setError(friendlyError(insertError.message));
      }
      else {
        setMessage(`${labelize(kind)} photo uploaded`);
        queryClient.invalidateQueries({ queryKey: ['job-media', id] });
      }
    } catch (err) {
      setSaving(false);
      setError(friendlyError(err));
    }
  };

  return (
    <ScreenBody loading={existing.isLoading} error={existing.error instanceof Error ? existing.error.message : null} onRetry={() => existing.refetch()}>
      <ScrollView contentContainerStyle={ui.pad}>
        <Text style={ui.muted}>Choose a label, then add the photo.</Text>
        <View style={ui.row}>
          {kinds.map((item) => <Choice key={item} label={labelize(item)} selected={kind === item} onPress={() => setKind(item)} />)}
        </View>
        <Button mode="contained" loading={saving} disabled={saving} onPress={upload}>Upload {labelize(kind).toLowerCase()} photo</Button>
        {message ? <Notice tone="ok" text={message} /> : null}
        {error ? <Notice tone="error" text={error} /> : null}
        {!existing.data?.length ? <Text style={ui.muted}>No photos yet.</Text> : null}
        {(existing.data ?? []).map((item) => (
          <View key={item.id} style={ui.card}>
            <Text style={ui.section}>{labelize(item.kind)}</Text>
            {item.url ? <Image source={{ uri: item.url }} style={{ width: '100%', height: 180, borderRadius: 12, backgroundColor: '#E2E8F0' }} /> : <Text style={ui.muted}>Photo could not be loaded.</Text>}
          </View>
        ))}
      </ScrollView>
    </ScreenBody>
  );
}
