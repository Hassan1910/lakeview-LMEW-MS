import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MOBILE_PAYSTACK_CALLBACK, PaystackInitSchema, paymentRoom } from '@lmew/shared-types';
import { useAuthStore } from '../../../src/store/authStore';
import { db, watchTable } from '../../../src/lib/db';
import { verifyPaystackPayment } from '../../../src/lib/paystack';
import { ScreenBody } from '../../../src/components/ScreenBody';
import { PaystackCheckout } from '../../../src/components/PaystackCheckout';
import { Choice, Notice, Page } from '../../../src/components/ui';
import { friendlyError, isPayableStatus, labelize, money, readFunctionError } from '../../../src/lib/format';
import { imageUploadBody } from '../../../src/lib/imageUpload';
import { ui } from '../../../src/theme';

const methods = ['mpesa', 'bank_transfer', 'cash', 'card', 'cheque'] as const;

type PayNotice = { tone: 'error' | 'ok' | 'info'; text: string };
type InvoicePayment = { id: string; amount: number; status: string; method: string; reference: string | null };
type Phase =
  | { name: 'ready' }
  | { name: 'verifying'; reference: string }
  | { name: 'processing'; reference: string; url: string | null }
  | { name: 'confirmed'; reference: string; amount: number | null }
  | { name: 'failed' }
  | { name: 'cancelled' }
  | { name: 'error'; reference: string | null };

type FinishOptions = { fromPoll?: boolean; keepOpen?: boolean; checkoutPoll?: boolean };

function paymentAmount(value: unknown) {
  const amount = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(amount) ? amount : null;
}

export default function PayScreen() {
  const params = useLocalSearchParams<{ invoiceId: string; paystackReference?: string }>();
  const invoiceId = params.invoiceId;
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(profile?.email ?? '');
  useEffect(() => {
    if (profile?.email) setEmail((current) => current || profile.email || '');
  }, [profile?.email]);
  const [method, setMethod] = useState<(typeof methods)[number]>('mpesa');
  const [receiptReference, setReceiptReference] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payNotice, setPayNotice] = useState<PayNotice | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [phase, setPhase] = useState<Phase>({ name: 'ready' });
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const submitting = useRef(false);
  const verifyLock = useRef(false);
  const pendingFinish = useRef<string | null>(null);
  const checkoutReference = useRef<string | null>(null);
  const seenReturn = useRef<string | null>(null);
  const finishRef = useRef<(reference: string, opts?: FinishOptions) => Promise<void>>(async () => {});
  const invoice = useQuery({
    queryKey: ['invoice', invoiceId],
    enabled: Boolean(invoiceId),
    queryFn: async () => {
      const { data, error: queryError } = await db()
        .from('invoices')
        .select('id, code, balance, currency, status, service_request_id, payments(id, amount, status, method, reference)')
        .eq('id', invoiceId)
        .single();
      if (queryError) throw queryError;
      return data;
    },
  });
  const invoiceRef = useRef(invoice);
  invoiceRef.current = invoice;

  const finishCheckout = async (reference: string, opts?: FinishOptions) => {
    if (verifyLock.current) {
      if (!opts?.checkoutPoll) pendingFinish.current = reference;
      return;
    }
    verifyLock.current = true;
    if (!opts?.fromPoll && !opts?.checkoutPoll) {
      setPhase({ name: 'verifying', reference });
      setPayNotice(null);
    }
    try {
      const result = await verifyPaystackPayment(reference, { observe: opts?.checkoutPoll === true });
      if (result.invoice_id && invoiceId && result.invoice_id !== invoiceId) {
        router.replace(`/(customer)/pay/${result.invoice_id}?paystackReference=${encodeURIComponent(result.reference || reference)}`);
        return;
      }
      if (opts?.checkoutPoll && result.outcome !== 'confirmed') return;
      const refreshed = await invoiceRef.current.refetch();
      const payments = (refreshed.data?.payments ?? []) as InvoicePayment[];
      const confirmedPayment = payments.find((payment) => payment.reference === reference && payment.status === 'confirmed');
      const confirmed = Boolean(confirmedPayment);
      const amount = paymentAmount(confirmedPayment?.amount) ?? paymentAmount(result.amount);
      if (opts?.checkoutPoll) {
        if (confirmed) {
          setCheckoutUrl(null);
          setPhase({ name: 'confirmed', reference, amount });
          setPayNotice({ tone: 'ok', text: 'Payment confirmed.' });
          void queryClient.invalidateQueries({ queryKey: ['my-invoices'] });
        }
        return;
      }
      if (result.outcome === 'confirmed' && confirmed) {
        setCheckoutUrl(null);
        setPhase({ name: 'confirmed', reference, amount });
        setPayNotice({ tone: 'ok', text: 'Payment confirmed.' });
        void queryClient.invalidateQueries({ queryKey: ['my-invoices'] });
        return;
      }
      if (result.outcome === 'confirmed') {
        setCheckoutUrl(null);
        setPhase({ name: 'processing', reference, url: result.authorization_url ?? null });
        setPayNotice({ tone: 'info', text: 'Payment is still processing. It will show here after it is confirmed.' });
        return;
      }
      if (result.outcome === 'processing') {
        if (!opts?.keepOpen && !opts?.fromPoll) setCheckoutUrl(null);
        const nextUrl = result.authorization_url ?? null;
        setPhase((current) => {
          const url = nextUrl ?? (current.name === 'processing' ? current.url : null);
          if (current.name === 'processing' && current.reference === reference && current.url === url) return current;
          return { name: 'processing', reference, url };
        });
        if (!opts?.fromPoll) setPayNotice({ tone: 'info', text: 'Payment is still processing.' });
        return;
      }
      if (result.outcome === 'cancelled') {
        setCheckoutUrl(null);
        setPhase({ name: 'cancelled' });
        setPayNotice({ tone: 'info', text: 'Payment cancelled. You have not been charged.' });
        return;
      }
      if (result.outcome === 'failed') {
        setCheckoutUrl(null);
        setPhase({ name: 'failed' });
        setPayNotice({ tone: 'error', text: 'Payment failed. You can try again.' });
        return;
      }
      if (opts?.keepOpen) {
        setPayNotice({ tone: 'error', text: result.message ?? 'Could not confirm the payment. Check again.' });
        return;
      }
      setCheckoutUrl(null);
      setPhase({ name: 'error', reference });
      setPayNotice({ tone: 'error', text: result.message ?? 'Could not confirm the payment. Check again.' });
    } finally {
      verifyLock.current = false;
      const next = pendingFinish.current;
      pendingFinish.current = null;
      if (next) void finishRef.current(next);
    }
  };
  finishRef.current = finishCheckout;

  useEffect(() => {
    if (!invoiceId) return;
    return watchTable('payments', () => {
      void queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ['my-invoices'] });
    }, `invoice_id=eq.${invoiceId}`);
  }, [invoiceId, queryClient]);

  useEffect(() => {
    const reference = typeof params.paystackReference === 'string' ? params.paystackReference : '';
    if (!reference || !invoiceId || seenReturn.current === reference) return;
    seenReturn.current = reference;
    void finishRef.current(reference);
  }, [params.paystackReference, invoiceId]);

  useEffect(() => {
    if (phase.name !== 'processing') return;
    const reference = phase.reference;
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > 90_000) {
        clearInterval(timer);
        return;
      }
      void finishRef.current(reference, { fromPoll: true });
    }, 3000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (!checkoutUrl) return;
    const timer = setInterval(() => {
      const reference = checkoutReference.current;
      if (!reference) return;
      void finishRef.current(reference, { checkoutPoll: true });
    }, 3000);
    return () => clearInterval(timer);
  }, [checkoutUrl]);

  const payable = isPayableStatus(invoice.data?.status) && Number(invoice.data?.balance) > 0;
  const serviceRequestId = invoice.data?.service_request_id as string | null | undefined;
  const busy = loading || phase.name === 'verifying';

  const pay = async () => {
    if (submitting.current || checkoutUrl || phase.name === 'processing' || phase.name === 'verifying') return;
    const parsed = PaystackInitSchema.safeParse({
      invoice_id: invoiceId,
      email: email.trim(),
      callback_url: MOBILE_PAYSTACK_CALLBACK,
    });
    if (!parsed.success) return setPayNotice({ tone: 'error', text: parsed.error.issues[0]?.message ?? 'Email is required' });
    submitting.current = true;
    setLoading(true);
    setError(null);
    setPayNotice(null);
    const { data, error: fnError } = await db().functions.invoke('create-paystack-payment', { body: parsed.data });
    setLoading(false);
    submitting.current = false;
    if (fnError || data?.error) {
      setPayNotice({ tone: 'error', text: await readFunctionError(fnError, data) });
      return;
    }
    if (data.status === 'confirmed' && data.reference) {
      await finishRef.current(data.reference);
      return;
    }
    if (data.authorization_url && data.reference) {
      checkoutReference.current = data.reference;
      setCheckoutUrl(data.authorization_url);
      return;
    }
    if (data.processing && data.reference) {
      await finishRef.current(data.reference);
      return;
    }
    setPayNotice({ tone: 'error', text: 'Paystack did not return a checkout page.' });
  };

  const markOffline = async () => {
    if (submitting.current || !profile || !invoice.data) return;
    const amount = Number(invoice.data.balance);
    const pendingAmounts = ((invoice.data.payments ?? []) as InvoicePayment[])
      .filter((payment) => payment.status === 'pending')
      .map((payment) => Number(payment.amount));
    const room = paymentRoom(amount, pendingAmounts, amount);
    if (!room.ok) return setError(room.message);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.8 });
    if (result.canceled) return;
    submitting.current = true;
    setLoading(true);
    setError(null);
    const asset = result.assets[0];
    const path = `${invoiceId}/proofs/${Date.now()}.jpg`;
    try {
      const { bytes, contentType } = imageUploadBody(asset);
      const upload = await db().storage.from('invoice-pdfs').upload(path, bytes, { contentType, upsert: true });
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
        reference: receiptReference.trim() || null,
        proof_path: path,
        recorded_by: profile.id,
      });
      setLoading(false);
      submitting.current = false;
      if (insertError) {
        await db().storage.from('invoice-pdfs').remove([path]);
        setError(friendlyError(insertError.message));
      }
      else {
        setMessage('Proof submitted. Finance will confirm the payment.');
        void queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      }
    } catch (err) {
      setLoading(false);
      submitting.current = false;
      setError(friendlyError(err));
    }
  };

  const downloadInvoice = async () => {
    if (!invoiceId || downloading) return;
    setDownloading(true);
    setError(null);
    const { data, error: fnError } = await db().functions.invoke('generate-pdf', { body: { type: 'invoice', id: invoiceId } });
    setDownloading(false);
    if (fnError || data?.error || !data?.signed_url) {
      setError(await readFunctionError(fnError, data));
      return;
    }
    await Linking.openURL(data.signed_url);
  };

  const showRecordActions = phase.name === 'confirmed' || invoice.data?.status === 'paid';
  const recordedPayments = (invoice.data?.payments ?? []) as InvoicePayment[];
  const confirmedPayments = recordedPayments.filter((payment) => payment.status === 'confirmed');
  const highlighted = phase.name === 'confirmed'
    ? confirmedPayments.find((payment) => payment.reference === phase.reference)
    : undefined;
  const amountPaid = phase.name === 'confirmed' && phase.amount != null
    ? phase.amount
    : highlighted
      ? paymentAmount(highlighted.amount)
      : confirmedPayments.reduce((sum, payment) => sum + (paymentAmount(payment.amount) ?? 0), 0);

  return (
    <>
      <ScreenBody loading={invoice.isLoading} error={invoice.error instanceof Error ? invoice.error.message : null} onRetry={() => invoice.refetch()}>
        <Page>
          <Text style={ui.title}>{invoice.data?.code ?? 'Invoice'}</Text>
          <TextInput label="Amount due" value={invoice.data ? money(invoice.data.balance, invoice.data.currency) : ''} editable={false} mode="outlined" />
          <Text style={ui.muted}>Status: {invoice.data?.status ? labelize(invoice.data.status) : '—'}</Text>
          {error ? <Notice tone="error" text={error} /> : null}
          {message ? <Notice tone="ok" text={message} /> : null}
          {payNotice ? <Notice tone={payNotice.tone} text={payNotice.text} /> : null}
          {showRecordActions ? <TextInput label="Amount paid" value={money(amountPaid, invoice.data?.currency)} editable={false} mode="outlined" /> : null}
          {showRecordActions ? <Button mode="contained" loading={downloading} disabled={downloading} onPress={downloadInvoice}>Download invoice</Button> : null}
          {showRecordActions ? <Button mode="outlined" onPress={() => router.push(`/(customer)/invoice/${invoiceId}`)}>View this invoice</Button> : null}
          {showRecordActions && serviceRequestId ? <Button mode="outlined" onPress={() => router.push(`/(customer)/request/${serviceRequestId}`)}>View this request</Button> : null}
          {payable && phase.name !== 'confirmed' ? (
            <>
              <TextInput label="Paystack email" value={email} onChangeText={setEmail} mode="outlined" autoCapitalize="none" keyboardType="email-address" />
              <Text style={ui.muted}>Checkout stays in the app for card or mobile money. It does not send an M-Pesa prompt to your phone.</Text>
              {phase.name === 'processing' ? (
                <>
                  <Button mode="contained" loading={busy} disabled={busy} onPress={() => { if (phase.name === 'processing') void finishRef.current(phase.reference); }}>Check again</Button>
                  {phase.url ? <Button mode="outlined" disabled={busy} onPress={() => { if (phase.name !== 'processing' || !phase.url) return; checkoutReference.current = phase.reference; setCheckoutUrl(phase.url); }}>Continue payment</Button> : null}
                </>
              ) : (
                <Button mode="contained" loading={busy} disabled={busy || Boolean(checkoutUrl)} onPress={pay}>Pay with Paystack</Button>
              )}
              {phase.name === 'error' && phase.reference ? (
                <Button mode="outlined" disabled={busy} onPress={() => { if (phase.name === 'error' && phase.reference) void finishRef.current(phase.reference); }}>Check again</Button>
              ) : null}
              <Text style={ui.section}>Already paid by M-Pesa, cash, or bank?</Text>
              <Text style={ui.muted}>Upload a photo of the receipt. Finance confirms it before the balance changes. This is not a second charge.</Text>
              <View style={ui.row}>
                {methods.map((item) => <Choice key={item} label={labelize(item)} selected={method === item} onPress={() => setMethod(item)} />)}
              </View>
              <TextInput label="Reference (optional)" value={receiptReference} onChangeText={setReceiptReference} mode="outlined" />
              <Button mode="outlined" loading={loading} disabled={loading} onPress={markOffline}>Upload proof</Button>
            </>
          ) : phase.name === 'confirmed' ? null : (
            <Notice tone={invoice.data?.status === 'paid' ? 'ok' : 'info'} text={invoice.data?.status === 'paid' ? 'This invoice is paid.' : 'This invoice is not open for payment.'} />
          )}
        </Page>
      </ScreenBody>
      {checkoutUrl ? (
        <PaystackCheckout
          url={checkoutUrl}
          onDone={() => {
            const reference = checkoutReference.current;
            setCheckoutUrl(null);
            if (reference) void finishRef.current(reference);
          }}
          onPartnerReturn={() => {
            const reference = checkoutReference.current;
            if (reference) void finishRef.current(reference, { keepOpen: true });
          }}
        />
      ) : null}
    </>
  );
}
