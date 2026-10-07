import React, { useRef, useState } from 'react';
import { Button, Text, TextInput } from 'react-native-paper';
import { Link } from 'expo-router';
import { RegisterSchema } from '@lmew/shared-types';
import { db } from '../../src/lib/db';
import { friendlyError } from '../../src/lib/format';
import { FormScreen, Notice } from '../../src/components/ui';
import { BrandInline } from '../../src/components/BrandMark';
import { ui } from '../../src/theme';

const fields = [
  { key: 'full_name', label: 'Full name', secure: false, capitalize: 'words' as const, keyboard: 'default' as const },
  { key: 'email', label: 'Email', secure: false, capitalize: 'none' as const, keyboard: 'email-address' as const },
  { key: 'phone', label: 'Phone (+254 or 07…)', secure: false, capitalize: 'none' as const, keyboard: 'phone-pad' as const },
  { key: 'password', label: 'Password', secure: true, capitalize: 'none' as const, keyboard: 'default' as const },
  { key: 'confirm_password', label: 'Confirm password', secure: true, capitalize: 'none' as const, keyboard: 'default' as const },
];

export default function RegisterScreen() {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', confirm_password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const submitting = useRef(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    if (submitting.current) return;
    const parsed = RegisterSchema.safeParse({ ...form, email: form.email.trim(), full_name: form.full_name.trim(), phone: form.phone.trim() });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form');
      return;
    }
    submitting.current = true;
    setLoading(true);
    setError(null);
    setSuccess(null);
    const { data, error: authError } = await db().auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { full_name: parsed.data.full_name, phone: parsed.data.phone } },
    });
    if (authError || !data.user) {
      setLoading(false);
      submitting.current = false;
      setError(friendlyError(authError?.message ?? 'Account could not be created'));
      return;
    }
    if (data.session) {
      const ensured = await db().rpc('ensure_my_customer');
      const profileUpdate = await db().from('profiles').update({
        phone: parsed.data.phone,
        full_name: parsed.data.full_name,
      }).eq('id', data.user.id);
      setLoading(false);
      submitting.current = false;
      if (ensured.error || profileUpdate.error) {
        setError(friendlyError(ensured.error?.message ?? profileUpdate.error?.message ?? 'Account created, but the profile was not saved'));
        return;
      }
      setSuccess('Account created. You are signed in.');
      return;
    }
    setLoading(false);
    submitting.current = false;
    setSuccess('Account created. Confirm your email, then sign in. Your customer profile is created on first sign-in.');
  };

  return (
    <FormScreen topInset>
      <BrandInline />
      <Text style={ui.muted}>Customers can register here. Staff accounts are issued by an administrator.</Text>
      {fields.map((field) => (
        <TextInput
          key={field.key}
          label={field.label}
          value={form[field.key as keyof typeof form]}
          onChangeText={set(field.key as keyof typeof form)}
          secureTextEntry={field.secure}
          autoCapitalize={field.capitalize}
          keyboardType={field.keyboard}
          mode="outlined"
        />
      ))}
      {error ? <Notice tone="error" text={error} /> : null}
      {success ? <Notice tone="ok" text={success} /> : null}
      <Button mode="contained" loading={loading} disabled={loading || Boolean(success)} onPress={submit}>Create account</Button>
      <Link href="/(auth)/login" asChild><Button mode="text">Back to sign in</Button></Link>
    </FormScreen>
  );
}
