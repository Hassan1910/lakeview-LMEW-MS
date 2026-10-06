import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { RegisterSchema } from '@lmew/shared-types';
import { db } from '../../src/lib/db';

export default function RegisterScreen() {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', confirm_password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    const parsed = RegisterSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form');
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: authError } = await db().auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { full_name: parsed.data.full_name, phone: parsed.data.phone } },
    });
    if (authError) {
      setLoading(false);
      setError(authError.message);
      return;
    }
    if (data.user) {
      await db().from('customers').insert({ profile_id: data.user.id, created_by: data.user.id });
      await db().from('profiles').update({ phone: parsed.data.phone, full_name: parsed.data.full_name }).eq('id', data.user.id);
    }
    setLoading(false);
    setSuccess(data.session ? 'Account created.' : 'Account created. Confirm your email, then sign in.');
  };

  return (
    <View style={styles.wrap}>
      {(['full_name', 'email', 'phone', 'password', 'confirm_password'] as const).map((key) => (
        <TextInput
          key={key}
          label={key.replace('_', ' ')}
          value={form[key]}
          onChangeText={set(key)}
          secureTextEntry={key.includes('password')}
          autoCapitalize={key === 'email' ? 'none' : 'words'}
          mode="outlined"
        />
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.ok}>{success}</Text> : null}
      <Button mode="contained" loading={loading} onPress={submit}>Create account</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 10, backgroundColor: '#F8FAFC' },
  error: { color: '#EF4444' },
  ok: { color: '#22C55E' },
});
