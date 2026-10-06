import React, { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { Calendar } from 'react-native-calendars';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { ServiceRequestCreateSchema, VesselCreateSchema, type ServiceCategory } from '@lmew/shared-types';
import { useAuthStore } from '../../src/store/authStore';
import { db, myCustomerId } from '../../src/lib/db';
import { ScreenBody } from '../../src/components/ScreenBody';
import { Choice, Notice } from '../../src/components/ui';
import { friendlyError, labelize, safeFileName } from '../../src/lib/format';
import { ui } from '../../src/theme';

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
      const { data, error } = await db().from('vessels').select('id, name').eq('customer_id', customerId);
      if (error) throw error;
      return { customerId, vessels: data ?? [] };
    },
  });
  const [form, setForm] = useState({ title: '', description: '', location_text: '', category: 'engine_maintenance' as ServiceCategory, priority: 'medium' as (typeof priorities)[number], preferred_date: '', vessel_id: '' });
  const [vesselDraft, setVesselDraft] = useState({ name: '', registration_no: '' });
  const [photos, setPhotos] = useState<{ uri: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const submitting = useRef(false);

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, selectionLimit: 5, mediaTypes: ['images'] });
    if (!result.canceled) {
      setPhotos(result.assets.slice(0, 5).map((asset, index) => ({ uri: asset.uri, name: safeFileName(asset.fileName ?? `photo-${index + 1}.jpg`) })));
    }
  };

  const addVessel = async () => {
    const customerId = vessels.data?.customerId;
    const parsed = VesselCreateSchema.safeParse(vesselDraft);
    if (!customerId || !parsed.success) return setError(parsed.success ? 'Your customer profile is missing.' : parsed.error.issues[0]?.message ?? 'Check the vessel');
    const { data, error: insertError } = await db().from('vessels').insert({ ...parsed.data, customer_id: customerId }).select('id').single();
    if (insertError || !data) return setError(friendlyError(insertError?.message ?? 'Could not add the vessel'));
    setForm({ ...form, vessel_id: data.id });
    setVesselDraft({ name: '', registration_no: '' });
    setError(null);
    queryClient.invalidateQueries({ queryKey: ['vessels', profile?.id] });
  };

  const submit = async () => {
    if (submitting.current) return;
    const customerId = vessels.data?.customerId;
    if (!customerId || !profile) return setError('Your customer profile is missing.');
    const parsed = ServiceRequestCreateSchema.safeParse({
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      location_text: form.location_text.trim(),
      vessel_id: form.vessel_id || null,
      preferred_date: form.preferred_date || null,
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the form');
    submitting.current = true;
    setLoading(true);
    setError(null);
    const { data, error: insertError } = await db().from('service_requests').insert({
      ...parsed.data,
      customer_id: customerId,
      created_by: profile.id,
    }).select('id').single();
    if (insertError || !data) {
      setLoading(false);
      submitting.current = false;
      setError(friendlyError(insertError?.message ?? 'Could not save the request'));
      return;
    }
    const failed: string[] = [];
    for (const photo of photos) {
      try {
        const response = await fetch(photo.uri);
        const bytes = await response.arrayBuffer();
        const path = `${data.id}/${photo.name}`;
        const upload = await db().storage.from('service-attachments').upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
        if (upload.error) {
          failed.push(photo.name);
          continue;
        }
        const inserted = await db().from('service_request_attachments').insert({
          service_request_id: data.id,
          storage_path: path,
          file_name: photo.name,
          mime_type: 'image/jpeg',
          uploaded_by: profile.id,
        });
        if (inserted.error) failed.push(photo.name);
      } catch {
        failed.push(photo.name);
      }
    }
    setLoading(false);
    submitting.current = false;
    queryClient.invalidateQueries({ queryKey: ['my-requests'] });
    queryClient.invalidateQueries({ queryKey: ['my-requests-list'] });
    if (failed.length) {
      setSavedId(data.id);
      setError(`Request saved, but these photos did not upload: ${failed.join(', ')}`);
      return;
    }
    router.replace(`/(customer)/request/${data.id}`);
  };

  return (
    <ScreenBody loading={vessels.isLoading} error={vessels.error instanceof Error ? vessels.error.message : null} onRetry={() => vessels.refetch()}>
      <ScrollView contentContainerStyle={ui.pad} keyboardShouldPersistTaps="handled">
        <Text style={ui.muted}>Tell the yard what needs work. You can add a vessel if it is not listed.</Text>
        <TextInput label="Title" value={form.title} onChangeText={(title) => setForm({ ...form, title })} mode="outlined" />
        <TextInput label="Description" multiline value={form.description} onChangeText={(description) => setForm({ ...form, description })} mode="outlined" />
        <TextInput label="Location" value={form.location_text} onChangeText={(location_text) => setForm({ ...form, location_text })} mode="outlined" placeholder="Kisumu Dunga Pier, Slipway 2" />
        <Text style={ui.section}>Priority</Text>
        <View style={ui.row}>
          {priorities.map((priority) => (
            <Choice key={priority} label={labelize(priority)} selected={form.priority === priority} onPress={() => setForm({ ...form, priority })} />
          ))}
        </View>
        <Text style={ui.section}>Category</Text>
        <View style={ui.row}>
          {categories.map((category) => (
            <Choice key={category} label={labelize(category)} selected={form.category === category} onPress={() => setForm({ ...form, category })} />
          ))}
        </View>
        <Button mode="outlined" onPress={() => setShowCalendar((value) => !value)}>
          {form.preferred_date ? `Preferred date: ${form.preferred_date}` : 'Choose a preferred date'}
        </Button>
        {showCalendar ? (
          <Calendar
            markedDates={form.preferred_date ? { [form.preferred_date]: { selected: true, selectedColor: '#0B4F6C' } } : {}}
            onDayPress={(day: { dateString: string }) => { setForm({ ...form, preferred_date: day.dateString }); setShowCalendar(false); }}
          />
        ) : null}
        <Text style={ui.section}>Vessel</Text>
        {(vessels.data?.vessels ?? []).length === 0 ? <Text style={ui.muted}>No vessels yet. Add one below, or submit without one.</Text> : null}
        <View style={ui.row}>
          {(vessels.data?.vessels ?? []).map((vessel) => (
            <Choice key={vessel.id} label={vessel.name} selected={form.vessel_id === vessel.id} onPress={() => setForm({ ...form, vessel_id: vessel.id })} />
          ))}
        </View>
        <TextInput label="New vessel name" value={vesselDraft.name} onChangeText={(name) => setVesselDraft({ ...vesselDraft, name })} mode="outlined" />
        <TextInput label="Registration number" value={vesselDraft.registration_no} onChangeText={(registration_no) => setVesselDraft({ ...vesselDraft, registration_no })} mode="outlined" />
        <Button mode="outlined" onPress={addVessel}>Add vessel</Button>
        <Button mode="outlined" onPress={pick}>Photos ({photos.length}/5)</Button>
        {error ? <Notice tone="error" text={error} /> : null}
        {savedId ? (
          <Button mode="contained" onPress={() => router.replace(`/(customer)/request/${savedId}`)}>Open request</Button>
        ) : (
          <Button mode="contained" loading={loading} disabled={loading} onPress={submit}>Submit request</Button>
        )}
      </ScrollView>
    </ScreenBody>
  );
}
