import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PaystackInitSchema } from '@lmew/shared-types';
import { useAuthStore } from '../../../src/store/authStore';
import { db, watchTable } from '../../../src/lib/db';
import { ScreenBody } from '../../../src/components/ScreenBody';
import { Choice, Notice, Page } from '../../../src/components/ui';
import { friendlyError, isPayableStatus, labelize, money, readFunctionError } from '../../../src/lib/format';
import { ui } from '../../../src/theme';

const methods = ['mpesa', 'bank_transfer', 'cash', 'card', 'cheque'] as const;

export default function PayScreen() {
  const { invoiceId } = useLocalSearchParams<{ invoiceId: string }>();
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(profile?.email ?? '');
  useEffect(() => {
    if (profile?.email) setEmail((current) => current || profile.email || '');
  }, [profile?.email]);
  const [method, setMethod] = useState<(typeof methods)[number]>('mpesa');
  const [reference, setReference] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const invoice = useQuery({
    queryKey: ['invoice', invoiceId],
    enabled: Boolean(invoiceId),
    queryFn: async () => {
      const { data, error: queryError } = await db().from('invoices').select('id, code, balance, currency, status').eq('id', invoiceId).single();
      if (queryError) throw queryError;
      return data;
    },
  });

  useEffect(() => {
    if (!invoiceId) return;
    return watchTable('payments', () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['my-invoices'] });
      setMessage('Payment update received.');
    }, `invoice_id=eq.${invoiceId}`);
  }, [invoiceId, queryClient]);

  const payable = isPayableStatus(invoice.data?.status) && Number(invoice.data?.balance) > 0;

  const pay = async () => {
    if (submitting.current) return;
    const parsed = PaystackInitSchema.safeParse({ invoice_id: invoiceId, email: email.trim() });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Email is required');
    submitting.current = true;
    setLoading(true);
    setError(null);
    const { data, error: fnError } = await db().functions.invoke('create-paystack-payment', { body: parsed.data });
    setLoading(false);
    submitting.current = false;
    if (fnError || data?.error) return setError(await readFunctionError(fnError, data));
    setMessage(`Payment of ${money(data.amount)} is pending (${data.reference}).`);
    if (data.authorization_url) await Linking.openURL(data.authorization_url);
  };

  const markOffline = async () => {
    if (submitting.current || !profile || !invoice.data) return;
    const amount = Number(invoice.data.balance);
    if (!Number.isFinite(amount) || amount <= 0) return setError('This invoice has no balance due.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
    if (result.canceled) return;
    submitting.current = true;
    setLoading(true);
    setError(null);
    const asset = result.assets[0];
    const path = `${invoiceId}/proofs/${Date.now()}.jpg`;
    try {
      const bytes = await (await fetch(asset.uri)).arrayBuffer();
      const upload = await db().storage.from('invoice-pdfs').upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (upload.error) {
        setLoading(false);
        submitting.current = false;
        return setError(friendlyError(upload.error.message));
      }
      const { error: insertError } = await db().from('payments').insert({
        invoice_id: invoiceId,
        amount,
        currency: invoice.data.currency ?? 'KES',
        method,
        status: 'pending',
        reference: reference.trim() || null,
        proof_path: path,
        recorded_by: profile.id,
      });
      setLoading(false);
      submitting.current = false;
      if (insertError) setError(friendlyError(insertError.message));
      else {
        setMessage('Proof submitted. Finance will confirm the payment.');
        queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      }
    } catch (err) {
      setLoading(false);
      submitting.current = false;
      setError(friendlyError(err));
    }
  };

  return (
    <ScreenBody loading={invoice.isLoading} error={invoice.error instanceof Error ? invoice.error.message : null} onRetry={() => invoice.refetch()}>
      <Page>
        <Text style={ui.title}>{invoice.data?.code ?? 'Invoice'}</Text>
        <TextInput label="Amount due" value={invoice.data ? money(invoice.data.balance, invoice.data.currency) : ''} editable={false} mode="outlined" />
        <Text style={ui.muted}>Status: {invoice.data?.status ? labelize(invoice.data.status) : '—'}</Text>
        {error ? <Notice tone="error" text={error} /> : null}
        {message ? <Notice tone="ok" text={message} /> : null}
        {payable ? (
          <>
            <TextInput label="Paystack email" value={email} onChangeText={setEmail} mode="outlined" autoCapitalize="none" keyboardType="email-address" />
            <Button mode="contained" loading={loading} disabled={loading} onPress={pay}>Pay with Paystack</Button>
            <Text style={ui.section}>Or submit proof of an offline payment</Text>
            <View style={ui.row}>
              {methods.map((item) => <Choice key={item} label={labelize(item)} selected={method === item} onPress={() => setMethod(item)} />)}
            </View>
            <TextInput label="Reference (optional)" value={reference} onChangeText={setReference} mode="outlined" />
            <Button mode="outlined" loading={loading} disabled={loading} onPress={markOffline}>Upload proof</Button>
          </>
        ) : (
          <Notice tone={invoice.data?.status === 'paid' ? 'ok' : 'info'} text={invoice.data?.status === 'paid' ? 'This invoice is paid.' : 'This invoice is not open for payment.'} />
        )}
      </Page>
    </ScreenBody>
  );
}
