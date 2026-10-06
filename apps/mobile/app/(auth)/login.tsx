import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { Link } from 'expo-router';
import { LoginSchema } from '@lmew/shared-types';
import { db } from '../../src/lib/db';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    const parsed = LoginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check your details');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: authError } = await db().auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (authError) setError(authError.message);
  };

  return (
    <View style={styles.wrap}>
      <Text variant="headlineSmall" style={styles.title}>Lakeview Marine</Text>
      <TextInput label="Email" autoCapitalize="none" value={email} onChangeText={setEmail} mode="outlined" />
      <TextInput label="Password" secureTextEntry value={password} onChangeText={setPassword} mode="outlined" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button mode="contained" loading={loading} onPress={signIn}>Sign in</Button>
      <Link href="/(auth)/register">Create an account</Link>
      <Link href="/(auth)/forgot-password">Forgot password</Link>
      <Link href="/(auth)/otp-verify">Sign in with phone code</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, gap: 12, justifyContent: 'center', backgroundColor: '#F8FAFC' },
  title: { color: '#0B4F6C', marginBottom: 8 },
  error: { color: '#EF4444' },
});
