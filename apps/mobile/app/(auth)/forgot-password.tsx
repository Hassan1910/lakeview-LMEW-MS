import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { db } from '../../src/lib/db';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError(null);
    const { error: resetError } = await db().auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (resetError) setError(resetError.message);
    else setMessage('If that email is registered, a reset link is on its way.');
  };

  return (
    <View style={styles.wrap}>
      <TextInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" mode="outlined" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.ok}>{message}</Text> : null}
      <Button mode="contained" loading={loading} onPress={submit}>Send reset link</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 12 },
  error: { color: '#EF4444' },
  ok: { color: '#22C55E' },
});
