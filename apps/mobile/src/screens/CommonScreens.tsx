import React, { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet } from 'react-native';
import { Button, List, Text, TextInput } from 'react-native-paper';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../store/authStore';
import { db, watchTable } from '../lib/db';
import { ScreenBody } from '../components/ScreenBody';
import { copy, useLanguage } from '../i18n';
import { openNotification } from '../lib/notificationRoutes';

export function NotificationsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['notifications-all', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await db().from('notifications').select('id, title, body, read_at, created_at, data').eq('user_id', profile!.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => {
    if (!profile?.id) return;
    return watchTable('notifications', () => queryClient.invalidateQueries({ queryKey: ['notifications-all', profile.id] }), `user_id=eq.${profile.id}`);
  }, [profile?.id, queryClient]);

  const mark = async (id: string, data: Record<string, unknown> | null) => {
    await db().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['notifications-all', profile?.id] });
    openNotification(data, profile?.role ?? null);
  };

  const groups = new Map<string, NonNullable<typeof query.data>>();
  for (const note of query.data ?? []) {
    const day = note.created_at.slice(0, 10);
    groups.set(day, [...(groups.get(day) ?? []), note]);
  }

  return (
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!query.data?.length} emptyLabel="No notifications." onRetry={() => query.refetch()}>
      <ScrollView>
        {[...groups.entries()].map(([day, notes]) => (
          <React.Fragment key={day}>
            <Text style={styles.day}>{day}</Text>
            {notes.map((note) => (
              <List.Item key={note.id} title={note.title} description={note.body ?? ''} onPress={() => mark(note.id, note.data as Record<string, unknown> | null)} right={() => <Text>{note.read_at ? 'Read' : 'New'}</Text>} />
            ))}
          </React.Fragment>
        ))}
      </ScrollView>
    </ScreenBody>
  );
}

export function ProfileScreen() {
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const signOut = useAuthStore((s) => s.signOut);
  const [form, setForm] = useState({ full_name: profile?.full_name ?? '', phone: profile?.phone ?? '', address: profile?.address ?? '' });
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { language, toggle, t } = useLanguage();

  const save = async () => {
    if (!profile) return;
    const { data, error: updateError } = await db().from('profiles').update(form).eq('id', profile.id).select('*').single();
    if (updateError) setError(updateError.message);
    else { setProfile(data); setMessage(t('saved')); setError(null); }
  };
  const uploadAvatar = async () => {
    if (!profile) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (result.canceled) return;
    const asset = result.assets[0];
    const bytes = await (await fetch(asset.uri)).arrayBuffer();
    const path = `${profile.id}/avatar.jpg`;
    const upload = await db().storage.from('avatars').upload(path, bytes, { upsert: true, contentType: 'image/jpeg' });
    if (upload.error) return setError(upload.error.message);
    const { data } = db().storage.from('avatars').getPublicUrl(path);
    const updated = await db().from('profiles').update({ avatar_url: data.publicUrl }).eq('id', profile.id).select('*').single();
    if (updated.data) setProfile(updated.data as typeof profile);
    setMessage(t('avatar'));
  };
  const changePassword = async () => {
    const { error: passwordError } = await db().auth.updateUser({ password });
    if (passwordError) setError(passwordError.message);
    else setMessage('Password updated');
  };

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text variant="titleMedium">{profile?.full_name}</Text>
      <TextInput label="Name" value={form.full_name} onChangeText={(full_name) => setForm({ ...form, full_name })} mode="outlined" />
      <TextInput label="Phone" value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} mode="outlined" />
      <TextInput label="Address" value={form.address} onChangeText={(address) => setForm({ ...form, address })} mode="outlined" />
      <Button mode="contained" onPress={save}>Save profile</Button>
      <Button onPress={uploadAvatar}>Upload avatar</Button>
      <TextInput label="New password" secureTextEntry value={password} onChangeText={setPassword} mode="outlined" />
      <Button onPress={changePassword}>Change password</Button>
      <Button mode="outlined" onPress={() => void toggle()}>{t('language')}: {language}</Button>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.ok}>{message}</Text> : null}
      <Button mode="text" onPress={signOut}>Log out</Button>
    </ScrollView>
  );
}

export function AboutScreen() {
  const query = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const { data, error } = await db().from('company_info').select('*').eq('id', 1).single();
      if (error) throw error;
      return data;
    },
  });
  return (
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!query.data} emptyLabel="Company profile is not published.">
      <ScrollView contentContainerStyle={styles.pad}>
        <Text variant="titleLarge">{query.data?.name}</Text>
        <Text>{query.data?.about}</Text>
        <Text>Mission: {query.data?.mission}</Text>
        <Text>Vision: {query.data?.vision}</Text>
      </ScrollView>
    </ScreenBody>
  );
}

export function HelpScreen() {
  const { t } = useLanguage();
  const company = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const { data, error } = await db().from('company_info').select('email').eq('id', 1).single();
      if (error) throw error;
      return data;
    },
  });
  const faqs = [
    [t('faqRequestQ'), t('faqRequestA')],
    [t('faqPayQ'), t('faqPayA')],
    [t('faqTrackQ'), t('faqTrackA')],
  ];
  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <List.AccordionGroup>
        {faqs.map(([question, answer], index) => (
          <List.Accordion key={question} id={String(index)} title={question}>
            <Text style={styles.pad}>{answer}</Text>
          </List.Accordion>
        ))}
      </List.AccordionGroup>
      <Button mode="contained" onPress={() => Linking.openURL(`mailto:${company.data?.email ?? 'service@lakeviewmarine.co.ke'}`)}>{t('support')}</Button>
    </ScrollView>
  );
}

export function ContactScreen() {
  const query = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const { data, error } = await db().from('company_info').select('*').eq('id', 1).single();
      if (error) throw error;
      return data;
    },
  });
  const info = query.data;
  return (
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!info} emptyLabel="Contact details are not available.">
      <ScrollView contentContainerStyle={styles.pad}>
        <Text>{info?.address}</Text>
        <Button onPress={() => info?.phone && Linking.openURL(`tel:${info.phone}`)}>Call</Button>
        <Button onPress={() => info?.email && Linking.openURL(`mailto:${info.email}`)}>Email</Button>
        <Button onPress={() => info?.latitude && Linking.openURL(`https://maps.google.com/?q=${info.latitude},${info.longitude}`)}>Open maps</Button>
        <Button onPress={() => info?.phone && Linking.openURL(`https://wa.me/${info.phone.replace(/\D/g, '')}`)}>WhatsApp</Button>
      </ScrollView>
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, gap: 10 },
  day: { marginTop: 12, marginLeft: 16, color: '#64748B' },
  error: { color: '#EF4444' },
  ok: { color: '#22C55E' },
});
