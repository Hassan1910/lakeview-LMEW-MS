import React, { useState } from 'react';
import { Button, Text, TextInput } from 'react-native-paper';
import { Link } from 'expo-router';
import { kenyanPhoneRegex } from '@lmew/shared-types';
import { db } from '../../src/lib/db';
import { friendlyError } from '../../src/lib/format';
import { FormScreen, Notice } from '../../src/components/ui';
import { BrandInline } from '../../src/components/BrandMark';
import { ui } from '../../src/theme';

export default function OtpVerifyScreen() {
  const [phone, setPhone] = useState('+254');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!kenyanPhoneRegex.test(phone.trim())) {
      setError('Enter a valid Kenyan phone number (+254 or 07/01…)');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: otpError } = await db().auth.signInWithOtp({ phone: phone.trim() });
    setLoading(false);
    if (otpError) setError(friendlyError(otpError.message));
    else setSent(true);
  };

  const verify = async () => {
    if (!/^\d{4,8}$/.test(code.trim())) {
      setError('Enter the code from the SMS');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: verifyError } = await db().auth.verifyOtp({ phone: phone.trim(), token: code.trim(), type: 'sms' });
    setLoading(false);
    if (verifyError) setError(friendlyError(verifyError.message));
  };

  return (
    <FormScreen topInset>
      <BrandInline />
      <Text style={ui.muted}>Optional phone sign-in for an account that already has this number.</Text>
      <TextInput label="Phone" value={phone} onChangeText={setPhone} mode="outlined" keyboardType="phone-pad" />
      {sent ? <TextInput label="Code" value={code} onChangeText={setCode} mode="outlined" keyboardType="number-pad" /> : null}
      {error ? <Notice tone="error" text={error} /> : null}
      {sent ? <Notice tone="ok" text="Code sent." /> : null}
      <Button mode="contained" loading={loading} disabled={loading} onPress={sent ? verify : send}>{sent ? 'Verify code' : 'Send code'}</Button>
      {sent ? <Button mode="text" onPress={() => { setSent(false); setCode(''); }}>Use a different number</Button> : null}
      <Link href="/(auth)/login" asChild><Button mode="text">Back to sign in</Button></Link>
    </FormScreen>
  );
}
