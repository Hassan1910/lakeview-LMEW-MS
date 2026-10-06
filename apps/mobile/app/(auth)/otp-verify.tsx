import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { db } from '../../src/lib/db';

export default function OtpVerifyScreen() {
  const [phone, setPhone] = useState('+254');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    setLoading(true);
    setError(null);
    const { error: otpError } = await db().auth.signInWithOtp({ phone });
    setLoading(false);
    if (otpError) setError(otpError.message);
    else setSent(true);
  };

  const verify = async () => {
    setLoading(true);
    const { error: verifyError } = await db().auth.verifyOtp({ phone, token: code, type: 'sms' });
    setLoading(false);
    if (verifyError) setError(verifyError.message);
  };

  return (
    <View style={styles.wrap}>
      <Text>Optional phone sign-in. Use a +254 number.</Text>
      <TextInput label="Phone" value={phone} onChangeText={setPhone} mode="outlined" />
      {sent ? <TextInput label="Code" value={code} onChangeText={setCode} mode="outlined" /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {sent ? <Text style={styles.ok}>Code sent.</Text> : null}
      <Button mode="contained" loading={loading} onPress={sent ? verify : send}>{sent ? 'Verify code' : 'Send code'}</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 12 },
  error: { color: '#EF4444' },
  ok: { color: '#22C55E' },
});
