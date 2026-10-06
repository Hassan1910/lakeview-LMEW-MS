import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { Calendar } from 'react-native-calendars';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { ServiceRequestCreateSchema, VesselCreateSchema, type ServiceCategory } from '@lmew/shared-types';
import { useAuthStore } from '../../src/store/authStore';
import { db, myCustomerId } from '../../src/lib/db';
import { ScreenBody } from '../../src/components/ScreenBody';

const categories: ServiceCategory[] = ['boat_repair', 'ship_repair', 'engine_maintenance', 'fabrication', 'electrical', 'welding', 'equipment_supply', 'consultation', 'other'];
const priorities = ['low', 'medium', 'high', 'urgent'] as const;

export default function NewRequestScreen() {
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const vessels = useQuery({
    queryKey: ['vessels', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const customerId = await myCustomerId(profile!.id);
      const { data, error } = await db().from('vessels').select('id, name').eq('customer_id', customerId ?? '');
      if (error) throw error;
      return { customerId, vessels: data ?? [] };
    },
  });
  const [form, setForm] = useState({ title: '', description: '', location_text: '', category: 'engine_maintenance' as ServiceCategory, priority: 'medium' as (typeof priorities)[number], preferred_date: '', vessel_id: '' });
  const [vesselDraft, setVesselDraft] = useState({ name: '', registration_no: '' });
  const [photos, setPhotos] = useState<{ uri: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, selectionLimit: 5, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!result.canceled) {
      setPhotos(result.assets.slice(0, 5).map((asset) => ({ uri: asset.uri, name: asset.fileName ?? `photo-${Date.now()}.jpg` })));
    }
  };

  const addVessel = async () => {
    const customerId = vessels.data?.customerId;
    const parsed = VesselCreateSchema.safeParse(vesselDraft);
    if (!customerId || !parsed.success) return setError(parsed.success ? 'Your customer profile is missing.' : parsed.error.issues[0]?.message ?? 'Check the vessel');
    const { data, error: insertError } = await db().from('vessels').insert({ ...parsed.data, customer_id: customerId }).select('id').single();
    if (insertError || !data) return setError(insertError?.message ?? 'Could not add the vessel');
    setForm({ ...form, vessel_id: data.id });
    setVesselDraft({ name: '', registration_no: '' });
    queryClient.invalidateQueries({ queryKey: ['vessels', profile?.id] });
  };

  const submit = async () => {
    const customerId = vessels.data?.customerId;
    if (!customerId || !profile) return setError('Your customer profile is missing.');
    const parsed = ServiceRequestCreateSchema.safeParse({
      ...form,
      vessel_id: form.vessel_id || null,
      preferred_date: form.preferred_date || null,
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the form');
    setLoading(true);
    setError(null);
    const { data, error: insertError } = await db().from('service_requests').insert({
      ...parsed.data,
      customer_id: customerId,
      created_by: profile.id,
    }).select('id').single();
    if (insertError || !data) {
      setLoading(false);
      setError(insertError?.message ?? 'Could not save the request');
      return;
    }
    for (const photo of photos) {
      const response = await fetch(photo.uri);
      const bytes = await response.arrayBuffer();
      const path = `${data.id}/${photo.name}`;
      const upload = await db().storage.from('service-attachments').upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (!upload.error) {
        await db().from('service_request_attachments').insert({
          service_request_id: data.id,
          storage_path: path,
          file_name: photo.name,
          mime_type: 'image/jpeg',
          uploaded_by: profile.id,
        });
      }
    }
    setLoading(false);
    setSuccess('Request submitted.');
    router.replace(`/(customer)/request/${data.id}`);
  };

  return (
    <ScreenBody loading={vessels.isLoading} error={vessels.error instanceof Error ? vessels.error.message : null} empty={!vessels.isLoading && !vessels.data?.customerId} emptyLabel="Your customer profile is missing.">
      <ScrollView contentContainerStyle={styles.pad}>
        <TextInput label="Title" value={form.title} onChangeText={(title) => setForm({ ...form, title })} mode="outlined" />
        <TextInput label="Description" multiline value={form.description} onChangeText={(description) => setForm({ ...form, description })} mode="outlined" />
        <TextInput label="Location" value={form.location_text} onChangeText={(location_text) => setForm({ ...form, location_text })} mode="outlined" />
        <Text>Priority</Text>
        <ScrollView horizontal>
          {priorities.map((priority) => (
            <Button key={priority} mode={form.priority === priority ? 'contained' : 'outlined'} onPress={() => setForm({ ...form, priority })}>{priority}</Button>
          ))}
        </ScrollView>
        <Text>Preferred date: {form.preferred_date || 'Not set'}</Text>
        <Calendar markedDates={form.preferred_date ? { [form.preferred_date]: { selected: true } } : {}} onDayPress={(day: { dateString: string }) => setForm({ ...form, preferred_date: day.dateString })} />
        <Text>Category: {form.category}</Text>
        <ScrollView horizontal>
          {categories.map((category) => (
            <Button key={category} mode={form.category === category ? 'contained' : 'outlined'} onPress={() => setForm({ ...form, category })}>{category}</Button>
          ))}
        </ScrollView>
        <Text>Vessel</Text>
        {(vessels.data?.vessels ?? []).length === 0 ? <Text>No vessels yet. Add one below.</Text> : null}
        {(vessels.data?.vessels ?? []).map((vessel) => (
          <Button key={vessel.id} mode={form.vessel_id === vessel.id ? 'contained' : 'text'} onPress={() => setForm({ ...form, vessel_id: vessel.id })}>{vessel.name}</Button>
        ))}
        <TextInput label="New vessel name" value={vesselDraft.name} onChangeText={(name) => setVesselDraft({ ...vesselDraft, name })} mode="outlined" />
        <TextInput label="Registration number" value={vesselDraft.registration_no} onChangeText={(registration_no) => setVesselDraft({ ...vesselDraft, registration_no })} mode="outlined" />
        <Button onPress={addVessel}>Add vessel</Button>
        <Button onPress={pick}>Photos ({photos.length}/5)</Button>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.ok}>{success}</Text> : null}
        <Button mode="contained" loading={loading} onPress={submit}>Submit request</Button>
      </ScrollView>
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, gap: 10 },
  error: { color: '#EF4444' },
  ok: { color: '#22C55E' },
});
