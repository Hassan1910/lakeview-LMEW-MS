import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PaystackInitSchema } from '@lmew/shared-types';
import { useAuthStore } from '../../../src/store/authStore';
import { db, watchTable } from '../../../src/lib/db';
import { ScreenBody } from '../../../src/components/ScreenBody';

const methods = ['mpesa', 'bank_transfer', 'cash', 'card', 'cheque'] as const;

export default function PayScreen() {
  const { invoiceId } = useLocalSearchParams<{ invoiceId: string }>();
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(profile?.email ?? '');
  const [method, setMethod] = useState<(typeof methods)[number]>('mpesa');
  const [reference, setReference] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const invoice = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: async () => {
      const { data, error: queryError } = await db().from('invoices').select('id, code, balance, currency, status').eq('id', invoiceId).single();
      if (queryError) throw queryError;
      return data;
    },
  });

  useEffect(() => {
    return watchTable('payments', () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      setMessage('Payment update received.');
    }, `invoice_id=eq.${invoiceId}`);
  }, [invoiceId, queryClient]);

  const pay = async () => {
    const parsed = PaystackInitSchema.safeParse({ invoice_id: invoiceId, email });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Email is required');
    setLoading(true);
    setError(null);
    const { data, error: fnError } = await db().functions.invoke('create-paystack-payment', { body: parsed.data });
    setLoading(false);
    if (fnError || data?.error) return setError(fnError?.message ?? data.error);
    setMessage(`Payment of KES ${data.amount} is pending (${data.reference}).`);
    if (data.authorization_url) await Linking.openURL(data.authorization_url);
  };

  const markOffline = async () => {
    if (!profile || !invoice.data) return;
    const amount = Number(invoice.data.balance);
    if (!Number.isFinite(amount) || amount <= 0) return setError('This invoice has no balance due.');
    setLoading(true);
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (result.canceled) {
      setLoading(false);
      return setError('Upload proof of payment.');
    }
    const asset = result.assets[0];
    const path = `${invoiceId}/proofs/${Date.now()}.jpg`;
    const bytes = await (await fetch(asset.uri)).arrayBuffer();
    const upload = await db().storage.from('invoice-pdfs').upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
    if (upload.error) {
      setLoading(false);
      return setError(upload.error.message);
    }
    const { error: insertError } = await db().from('payments').insert({
      invoice_id: invoiceId,
      amount,
      currency: invoice.data.currency ?? 'KES',
      method,
      status: 'pending',
      reference: reference || null,
      proof_path: path,
      recorded_by: profile.id,
    });
    setLoading(false);
    if (insertError) setError(insertError.message);
    else setMessage('Proof submitted. Finance will confirm the payment.');
  };

  const paid = invoice.data?.status === 'paid';
  return (
    <ScreenBody loading={invoice.isLoading} error={invoice.error instanceof Error ? invoice.error.message : null}>
      <View style={styles.pad}>
        <Text variant="titleMedium">{invoice.data?.code}</Text>
        <TextInput label="Amount due" value={invoice.data ? `${invoice.data.balance} ${invoice.data.currency}` : ''} editable={false} mode="outlined" />
        <Text>Status: {invoice.data?.status}</Text>
        <TextInput label="Paystack email" value={email} onChangeText={setEmail} mode="outlined" autoCapitalize="none" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.ok}>{message}</Text> : null}
        {paid ? <Text style={styles.ok}>This invoice is paid.</Text> : (
          <>
            <Button mode="contained" loading={loading} onPress={pay}>Pay with Paystack</Button>
            <Text variant="titleSmall">Or mark as paid offline</Text>
            {methods.map((item) => <Button key={item} mode={method === item ? 'contained' : 'text'} onPress={() => setMethod(item)}>{item}</Button>)}
            <TextInput label="Reference (optional)" value={reference} onChangeText={setReference} mode="outlined" />
            <Button mode="outlined" loading={loading} onPress={markOffline}>Upload proof</Button>
          </>
        )}
      </View>
    </ScreenBody>
  );
}

const styles = StyleSheet.create({ pad: { padding: 16, gap: 12 }, error: { color: '#EF4444' }, ok: { color: '#22C55E' } });
