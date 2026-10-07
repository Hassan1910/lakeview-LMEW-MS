import React, { useState } from 'react';
import { Button, TextInput } from 'react-native-paper';
import { Link } from 'expo-router';
import { z } from 'zod';
import { db } from '../../src/lib/db';
import { friendlyError } from '../../src/lib/format';
import { FormScreen, Notice } from '../../src/components/ui';
import { BrandInline } from '../../src/components/BrandMark';

const emailSchema = z.string().email('Enter the email on your account');

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a valid email');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    const { error: resetError } = await db().auth.resetPasswordForEmail(parsed.data);
    setLoading(false);
    if (resetError) setError(friendlyError(resetError.message));
    else setMessage('If that email is registered, a reset link is on its way.');
  };

  return (
    <FormScreen topInset>
      <BrandInline />
      <TextInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" mode="outlined" />
      {error ? <Notice tone="error" text={error} /> : null}
      {message ? <Notice tone="ok" text={message} /> : null}
      <Button mode="contained" loading={loading} disabled={loading} onPress={submit}>Send reset link</Button>
      <Link href="/(auth)/login" asChild><Button mode="text">Back to sign in</Button></Link>
    </FormScreen>
  );
}
