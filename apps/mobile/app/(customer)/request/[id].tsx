import React, { useEffect, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { Link, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../src/store/authStore';
import { db, watchTable } from '../../../src/lib/db';
import { ScreenBody } from '../../../src/components/ScreenBody';
import { StatusStepper } from '../../../src/components/StatusStepper';
import { FieldLine, Notice } from '../../../src/components/ui';
import { friendlyError, labelize, money, readFunctionError } from '../../../src/lib/format';
import { ui } from '../../../src/theme';

type Quote = { id: string; code: string | null; status: string; total: number; currency: string };
type Invoice = { id: string; code: string | null; status: string; balance: number; currency?: string };

export default function RequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useQuery({
    queryKey: ['request', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await db().from('service_requests').select('*, vessel:vessels(name), quotations(id, code, status, total, currency), invoices(id, code, status, balance, currency)').eq('id', id).single();
      if (error) throw error;
      return data;
    },
  });
  const messages = useQuery({
    queryKey: ['messages', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await db().from('messages').select('id, body, created_at, sender_id').eq('service_request_id', id).order('created_at');
      if (error) throw error;
      return data ?? [];
    },
  });
  const files = useQuery({
    queryKey: ['attachments', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await db().from('service_request_attachments').select('id, file_name, storage_path').eq('service_request_id', id);
      if (error) throw error;
      return Promise.all((data ?? []).map(async (file) => {
        const signed = await db().storage.from('service-attachments').createSignedUrl(file.storage_path, 3600);
        return { ...file, url: signed.data?.signedUrl ?? null };
      }));
    },
  });

  useEffect(() => {
    if (!id) return;
    const stopRequest = watchTable('service_requests', () => queryClient.invalidateQueries({ queryKey: ['request', id] }), `id=eq.${id}`);
    const stopMessages = watchTable('messages', () => queryClient.invalidateQueries({ queryKey: ['messages', id] }), `service_request_id=eq.${id}`);
    return () => { stopRequest(); stopMessages(); };
  }, [id, queryClient]);

  const row = request.data;

  const respond = async (status: 'accepted' | 'rejected') => {
    const quote = ((row?.quotations ?? []) as Quote[]).find((item) => item.status === 'sent');
    if (!quote) return setSendError('There is no quotation waiting for approval.');
    setBusy(true);
    const { error } = await db().from('quotations').update({ status }).eq('id', quote.id);
    setBusy(false);
    if (error) setSendError(friendlyError(error.message));
    else {
      setActionMessage(status === 'accepted' ? 'Quotation accepted. The yard can start the repair.' : 'Quotation rejected.');
      setSendError(null);
      queryClient.invalidateQueries({ queryKey: ['request', id] });
    }
  };

  const send = async () => {
    if (!profile || !body.trim() || busy) return;
    setBusy(true);
    const { error } = await db().from('messages').insert({ service_request_id: id, sender_id: profile.id, body: body.trim() });
    setBusy(false);
    if (error) setSendError(friendlyError(error.message));
    else { setBody(''); setSendError(null); queryClient.invalidateQueries({ queryKey: ['messages', id] }); }
  };

  const downloadQuote = async (quoteId: string) => {
    setBusy(true);
    setSendError(null);
    const { data, error } = await db().functions.invoke('generate-pdf', { body: { type: 'quotation', id: quoteId } });
    setBusy(false);
    if (error || data?.error || !data?.signed_url) {
      setSendError(await readFunctionError(error, data));
      return;
    }
    await Linking.openURL(data.signed_url);
  };

  return (
    <ScreenBody loading={request.isLoading} error={request.error instanceof Error ? request.error.message : null} onRetry={() => request.refetch()}>
      <ScrollView contentContainerStyle={ui.pad}>
        <Text style={ui.title}>{row?.title}</Text>
        <Text style={ui.muted}>{row?.code}</Text>
        {row ? <StatusStepper status={row.status} /> : null}
        <Text style={ui.body}>{row?.description}</Text>
        <FieldLine label="Vessel" value={row?.vessel?.name ?? 'Not set'} />
        <FieldLine label="Location" value={row?.location_text} />
        {((row?.quotations ?? []) as Quote[]).map((quote) => (
          <View key={quote.id} style={ui.card}>
            <Text style={ui.section}>{quote.code ?? 'Quotation'}</Text>
            <Text style={ui.muted}>{labelize(quote.status)} · {money(quote.total, quote.currency)}</Text>
            <Button mode="outlined" disabled={busy} onPress={() => downloadQuote(quote.id)}>Download quotation</Button>
            {quote.status === 'sent' ? (
              <View style={ui.row}>
                <Button mode="contained" disabled={busy} onPress={() => respond('accepted')}>Accept</Button>
                <Button mode="outlined" disabled={busy} onPress={() => respond('rejected')}>Reject</Button>
              </View>
            ) : null}
          </View>
        ))}
        {((row?.invoices ?? []) as Invoice[]).map((invoice) => (
          <Link key={invoice.id} href={`/(customer)/invoice/${invoice.id}`} asChild>
            <Button mode="outlined">Invoice {invoice.code ?? ''} · {labelize(invoice.status)} · balance {money(invoice.balance, invoice.currency)}</Button>
          </Link>
        ))}
        <Text style={ui.section}>Photos</Text>
        {(files.data ?? []).length === 0 ? <Text style={ui.muted}>No photos yet.</Text> : null}
        <View style={{ gap: 8 }}>
          {(files.data ?? []).map((file) => file.url ? <Image key={file.id} source={{ uri: file.url }} style={{ width: '100%', height: 180, borderRadius: 12, backgroundColor: '#E2E8F0' }} /> : <Text key={file.id} style={ui.muted}>{file.file_name} could not be loaded.</Text>)}
        </View>
        <Text style={ui.section}>Messages</Text>
        {(messages.data ?? []).length === 0 ? <Text style={ui.muted}>No messages yet.</Text> : null}
        {(messages.data ?? []).map((message) => (
          <View key={message.id} style={ui.card}>
            <Text style={ui.muted}>{message.sender_id === profile?.id ? 'You' : 'Yard'}</Text>
            <Text style={ui.body}>{message.body}</Text>
          </View>
        ))}
        <TextInput label="Message the yard" value={body} onChangeText={setBody} mode="outlined" />
        {actionMessage ? <Notice tone="ok" text={actionMessage} /> : null}
        {sendError ? <Notice tone="error" text={sendError} /> : null}
        <Button mode="contained" disabled={busy || !body.trim()} loading={busy} onPress={send}>Send</Button>
        {row?.status === 'completed' ? <Link href={`/(customer)/feedback/${id}`} asChild><Button mode="outlined">Leave feedback</Button></Link> : null}
      </ScrollView>
    </ScreenBody>
  );
}
