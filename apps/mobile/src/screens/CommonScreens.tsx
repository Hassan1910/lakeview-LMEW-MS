import React, { useEffect, useRef, useState } from 'react';
import { Linking, RefreshControl, ScrollView, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import { kenyanPhoneRegex } from '@lmew/shared-types';
import { useAuthStore } from '../store/authStore';
import { db, watchTable } from '../lib/db';
import { ScreenBody } from '../components/ScreenBody';
import { FieldLine, Notice, Page } from '../components/ui';
import { useLanguage } from '../i18n';
import { dayLabel, friendlyError, labelize, safeFileName } from '../lib/format';
import { imageUploadBody } from '../lib/imageUpload';
import { openNotification } from '../lib/notificationRoutes';
import { BrandLockup } from '../components/BrandMark';
import { AlertRow } from '../components/AlertRow';
import { Avatar } from '../components/Avatar';
import { ScreenHeader } from '../components/ScreenHeader';
import { SettingsRow } from '../components/SettingsRow';
import { palette, ui } from '../theme';

function areaFor(role: string | null | undefined) {
  if (role === 'technician') return '/(technician)';
  if (role === 'supervisor') return '/(supervisor)';
  return '/(customer)';
}

export function NotificationsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['notifications-all', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await db().from('notifications').select('id, type, title, body, read_at, created_at, data').eq('user_id', profile!.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => {
    if (!profile?.id) return;
    return watchTable('notifications', () => queryClient.invalidateQueries({ queryKey: ['notifications-all', profile.id] }), `user_id=eq.${profile.id}`);
  }, [profile?.id, queryClient]);

  const mark = async (id: string, data: Record<string, unknown> | null, alreadyRead: boolean) => {
    if (!alreadyRead) {
      await db().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', profile!.id);
      queryClient.invalidateQueries({ queryKey: ['notifications-all', profile?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications', profile?.id] });
    }
    await openNotification(data, profile?.role ?? null);
  };

  const groups = new Map<string, NonNullable<typeof query.data>>();
  for (const note of query.data ?? []) {
    const day = dayLabel(note.created_at);
    groups.set(day, [...(groups.get(day) ?? []), note]);
  }

  return (
    <ScreenBody
      loading={query.isLoading}
      skeleton={4}
      error={query.error instanceof Error ? query.error.message : null}
      empty={!query.data?.length}
      emptyIcon="bell-off-outline"
      emptyTitle="No notifications yet"
      emptyLabel="Updates about your jobs and requests will appear here."
      onRetry={() => query.refetch()}
    >
      <ScrollView
        contentContainerStyle={ui.pad}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={palette.primary} />}
      >
        {[...groups.entries()].map(([day, notes]) => (
          <View key={day} style={{ gap: 8 }}>
            <Text style={ui.caption}>{day}</Text>
            {notes.map((note) => (
              <AlertRow
                key={note.id}
                title={note.title}
                body={note.body}
                type={note.type}
                createdAt={note.created_at}
                unread={!note.read_at}
                onPress={() => mark(note.id, note.data as Record<string, unknown> | null, Boolean(note.read_at))}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </ScreenBody>
  );
}

export function ProfileScreen() {
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const signOut = useAuthStore((s) => s.signOut);
  const [form, setForm] = useState({ full_name: '', phone: '', address: '' });
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const hydratedFor = useRef<string | null>(null);
  const { language, toggle, t } = useLanguage();
  const area = areaFor(profile?.role);

  useEffect(() => {
    if (!profile || hydratedFor.current === profile.id) return;
    hydratedFor.current = profile.id;
    setForm({ full_name: profile.full_name ?? '', phone: profile.phone ?? '', address: profile.address ?? '' });
  }, [profile]);

  const save = async () => {
    if (!profile) return;
    const full_name = form.full_name.trim();
    const phone = form.phone.trim();
    const address = form.address.trim();
    if (full_name.length < 2) return setError('Enter your name');
    if (phone && !kenyanPhoneRegex.test(phone)) return setError('Enter a valid Kenyan phone number');
    setSaving(true);
    setError(null);
    setMessage(null);
    const { data, error: updateError } = await db().from('profiles').update({
      full_name,
      phone: phone || null,
      address: address || null,
    }).eq('id', profile.id).select('*').single();
    setSaving(false);
    if (updateError || !data) setError(friendlyError(updateError?.message ?? 'Could not save'));
    else { setProfile(data); setMessage(t('saved')); }
  };

  const uploadAvatar = async () => {
    if (!profile) return;
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.8 });
    if (result.canceled) return;
    setSaving(true);
    const asset = result.assets[0];
    let bytes: ArrayBuffer;
    let contentType: string;
    try {
      ({ bytes, contentType } = imageUploadBody(asset));
    } catch (err) {
      setSaving(false);
      return setError(friendlyError(err));
    }
    const path = `${profile.id}/${safeFileName('avatar.jpg')}`;
    const upload = await db().storage.from('avatars').upload(path, bytes, { upsert: true, contentType });
    if (upload.error) {
      setSaving(false);
      return setError(friendlyError(upload.error.message));
    }
    const { data } = db().storage.from('avatars').getPublicUrl(path);
    const updated = await db().from('profiles').update({ avatar_url: data.publicUrl }).eq('id', profile.id).select('*').single();
    setSaving(false);
    if (updated.error || !updated.data) return setError(friendlyError(updated.error?.message ?? 'Could not save the photo'));
    setProfile(updated.data);
    setMessage(t('avatar'));
  };

  const changePassword = async () => {
    if (password.length < 8 || !/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
      setError('Password must be at least 8 characters and include a letter and a number');
      return;
    }
    setSaving(true);
    setError(null);
    const { error: passwordError } = await db().auth.updateUser({ password });
    setSaving(false);
    if (passwordError) setError(friendlyError(passwordError.message));
    else { setMessage('Password updated'); setPassword(''); }
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const open = (href: string) => router.push(href as never);

  return (
    <Page>
      <ScreenHeader
        eyebrow={labelize(profile?.role) || 'Account'}
        title={profile?.full_name || 'Profile'}
        subtitle={[profile?.email, profile?.phone].filter(Boolean).join(' · ')}
        trailing={<Avatar name={profile?.full_name} uri={profile?.avatar_url} size={56} />}
      />
      <Text style={ui.section}>Your details</Text>
      <TextInput label="Name" value={form.full_name} onChangeText={(full_name) => setForm({ ...form, full_name })} mode="outlined" />
      <TextInput label="Phone" value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} mode="outlined" keyboardType="phone-pad" />
      <TextInput label="Address" value={form.address} onChangeText={(address) => setForm({ ...form, address })} mode="outlined" />
      <Button mode="contained" loading={saving} disabled={saving} onPress={save}>Save profile</Button>
      <Button mode="outlined" icon="image-outline" disabled={saving} onPress={uploadAvatar}>Change photo</Button>
      <Text style={ui.section}>Password</Text>
      <TextInput label="New password" secureTextEntry value={password} onChangeText={setPassword} mode="outlined" />
      <Button mode="outlined" disabled={saving || !password} onPress={changePassword}>Change password</Button>
      <Text style={ui.section}>Preferences</Text>
      <SettingsRow icon="translate" label={t('language')} detail={language === 'SW' ? 'Kiswahili' : 'English'} onPress={() => void toggle()} />
      {profile?.role === 'customer' ? (
        <>
          <Text style={ui.section}>Yard</Text>
          <SettingsRow icon="ferry" label="My vessels" onPress={() => open('/(customer)/vessels')} />
          <SettingsRow icon="file-document-outline" label="Quotations" onPress={() => open('/(customer)/quotations')} />
          <SettingsRow icon="bell-outline" label="Notifications" onPress={() => open('/(customer)/notifications')} />
        </>
      ) : (
        <>
          <Text style={ui.section}>Work</Text>
          <SettingsRow icon="bell-outline" label={profile?.role === 'technician' ? 'Alerts' : 'Notifications'} onPress={() => open(`${area}/notifications`)} />
        </>
      )}
      <Text style={ui.section}>Lakeview</Text>
      <SettingsRow icon="information-outline" label="About" onPress={() => open(`${area}/about`)} />
      <SettingsRow icon="help-circle-outline" label="Help" onPress={() => open(`${area}/help`)} />
      <SettingsRow icon="phone-outline" label="Contact" onPress={() => open(`${area}/contact`)} />
      {error ? <Notice tone="error" text={error} /> : null}
      {message ? <Notice tone="ok" text={message} /> : null}
      <SettingsRow icon="logout" label="Log out" danger onPress={signOut} />
      <Text style={ui.caption}>Version {version}</Text>
    </Page>
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
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!query.data} emptyLabel="Company profile is not published yet." onRetry={() => query.refetch()}>
      <Page>
        <BrandLockup tone="dark" />
        <Text style={ui.title}>{query.data?.name}</Text>
        <Text style={ui.body}>{query.data?.about}</Text>
        <FieldLine label="Mission" value={query.data?.mission} />
        <FieldLine label="Vision" value={query.data?.vision} />
      </Page>
    </ScreenBody>
  );
}

export function HelpScreen() {
  const { t } = useLanguage();
  const company = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const { data, error } = await db().from('company_info').select('email').eq('id', 1).maybeSingle();
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
    <Page>
      {faqs.map(([question, answer]) => (
        <View key={question} style={ui.card}>
          <Text style={ui.section}>{question}</Text>
          <Text style={ui.body}>{answer}</Text>
        </View>
      ))}
      <Button mode="contained" onPress={() => Linking.openURL(`mailto:${company.data?.email ?? 'service@lakeviewmarine.co.ke'}`)}>{t('support')}</Button>
    </Page>
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
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!info} emptyLabel="Contact details are not available." onRetry={() => query.refetch()}>
      <Page>
        <Text style={ui.title}>{info?.name ?? 'Contact'}</Text>
        <FieldLine label="Address" value={info?.address} />
        <FieldLine label="Phone" value={info?.phone} />
        <FieldLine label="Email" value={info?.email} />
        <Button mode="contained" disabled={!info?.phone} onPress={() => info?.phone && Linking.openURL(`tel:${info.phone}`)}>Call</Button>
        <Button mode="outlined" disabled={!info?.email} onPress={() => info?.email && Linking.openURL(`mailto:${info.email}`)}>Email</Button>
        <Button mode="outlined" disabled={!info?.latitude} onPress={() => info?.latitude && Linking.openURL(`https://maps.google.com/?q=${info.latitude},${info.longitude}`)}>Open maps</Button>
        <Button mode="outlined" disabled={!info?.phone} onPress={() => info?.phone && Linking.openURL(`https://wa.me/${info.phone.replace(/\D/g, '')}`)}>WhatsApp</Button>
      </Page>
    </ScreenBody>
  );
}
