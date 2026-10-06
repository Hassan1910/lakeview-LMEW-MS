import React, { useState } from 'react';
import { Button, Text, TextInput } from 'react-native-paper';
import { Link } from 'expo-router';
import { LoginSchema } from '@lmew/shared-types';
import { db } from '../../src/lib/db';
import { friendlyError } from '../../src/lib/format';
import { useAuthStore } from '../../src/store/authStore';
import { FormScreen, Notice } from '../../src/components/ui';
import { palette, ui } from '../../src/theme';

export default function LoginScreen() {
  const profileError = useAuthStore((s) => s.profileError);
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const signOut = useAuthStore((s) => s.signOut);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    const parsed = LoginSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check your details');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: authError } = await db().auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (authError) setError(friendlyError(authError.message));
  };

  return (
    <FormScreen topInset>
      <Text variant="headlineSmall" style={{ color: palette.primary, fontWeight: '700' }}>Lakeview Marine</Text>
      <Text style={ui.muted}>Sign in to track repairs, jobs, and payments.</Text>
      {session && !profile ? (
        <>
          <Notice tone="error" text={profileError ?? 'Your profile could not be loaded.'} />
          <Button mode="contained" onPress={() => void loadProfile()}>Try again</Button>
          <Button mode="text" onPress={signOut}>Sign out</Button>
        </>
      ) : (
        <>
          <TextInput label="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} mode="outlined" />
          <TextInput
            label="Password"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            autoComplete="password"
            right={<TextInput.Icon icon={showPassword ? 'eye-off' : 'eye'} onPress={() => setShowPassword((value) => !value)} />}
          />
          {error ? <Notice tone="error" text={error} /> : null}
          <Button mode="contained" loading={loading} disabled={loading} onPress={signIn}>Sign in</Button>
          <Link href="/(auth)/register" asChild><Button mode="text">Create an account</Button></Link>
          <Link href="/(auth)/forgot-password" asChild><Button mode="text">Forgot password</Button></Link>
          <Link href="/(auth)/otp-verify" asChild><Button mode="text">Sign in with a phone code</Button></Link>
        </>
      )}
    </FormScreen>
  );
}
