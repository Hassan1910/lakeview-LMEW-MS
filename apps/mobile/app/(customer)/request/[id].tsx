import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet } from 'react-native';
import { Button, Card, Text, TextInput } from 'react-native-paper';
import { Link, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../src/store/authStore';
import { db, watchTable } from '../../../src/lib/db';
import { ScreenBody } from '../../../src/components/ScreenBody';
import { StatusStepper } from '../../../src/components/StatusStepper';

export default function RequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const request = useQuery({
    queryKey: ['request', id],
    queryFn: async () => {
      const { data, error } = await db().from('service_requests').select('*, vessel:vessels(name), quotations(id, code, status, total, currency), invoices(id, code, status, balance)').eq('id', id).single();
      if (error) throw error;
      return data;
    },
  });
  const messages = useQuery({
    queryKey: ['messages', id],
    queryFn: async () => {
      const { data, error } = await db().from('messages').select('id, body, created_at, sender_id').eq('service_request_id', id).order('created_at');
      if (error) throw error;
      return data ?? [];
    },
  });
  const files = useQuery({
    queryKey: ['attachments', id],
    queryFn: async () => {
      const { data, error } = await db().from('service_request_attachments').select('id, file_name, storage_path').eq('service_request_id', id);
      if (error) throw error;
      const withUrls = await Promise.all((data ?? []).map(async (file) => {
        const signed = await db().storage.from('service-attachments').createSignedUrl(file.storage_path, 3600);
        return { ...file, url: signed.data?.signedUrl ?? null };
      }));
      return withUrls;
    },
  });

  useEffect(() => {
    const stopRequest = watchTable('service_requests', () => queryClient.invalidateQueries({ queryKey: ['request', id] }), `id=eq.${id}`);
    const stopMessages = watchTable('messages', () => queryClient.invalidateQueries({ queryKey: ['messages', id] }), `service_request_id=eq.${id}`);
    return () => { stopRequest(); stopMessages(); };
  }, [id, queryClient]);

  const row = request.data;

  const respond = async (status: 'accepted' | 'rejected') => {
    const quote = (row?.quotations ?? []).find((item: { id: string; status: string }) => item.status === 'sent');
    if (!quote) return setSendError('There is no quotation waiting for approval.');
    const { error } = await db().from('quotations').update({ status }).eq('id', quote.id);
    if (error) setSendError(error.message);
    else {
      setActionMessage(status === 'accepted' ? 'Quotation accepted. Repair can start.' : 'Quotation rejected.');
      setSendError(null);
      queryClient.invalidateQueries({ queryKey: ['request', id] });
    }
  };

  const send = async () => {
    if (!profile || !body.trim()) return;
    const { error } = await db().from('messages').insert({ service_request_id: id, sender_id: profile.id, body: body.trim() });
    if (error) setSendError(error.message);
    else { setBody(''); setSendError(null); }
  };

  return (
    <ScreenBody loading={request.isLoading} error={request.error instanceof Error ? request.error.message : null} onRetry={() => request.refetch()}>
      <ScrollView contentContainerStyle={styles.pad}>
        <Text variant="titleLarge">{row?.title}</Text>
        <Text>{row?.code}</Text>
        {row ? <StatusStepper status={row.status} /> : null}
        <Text>{row?.description}</Text>
        <Text>Vessel: {row?.vessel?.name ?? 'Not set'}</Text>
        {(row?.quotations ?? []).map((quote: { id: string; code: string | null; status: string; total: number; currency: string }) => (
          <Card key={quote.id}>
            <Card.Title title={quote.code ?? 'Quotation'} subtitle={`${quote.status} · ${quote.total} ${quote.currency}`} />
            {quote.status === 'sent' ? (
              <Card.Actions>
                <Button onPress={() => respond('accepted')}>Accept</Button>
                <Button onPress={() => respond('rejected')}>Reject</Button>
              </Card.Actions>
            ) : null}
          </Card>
        ))}
        {(row?.invoices ?? []).map((invoice: { id: string; code: string | null; status: string; balance: number }) => (
          <Link key={invoice.id} href={`/(customer)/invoice/${invoice.id}`}>Invoice {invoice.code} · {invoice.status} · balance {invoice.balance}</Link>
        ))}
        <Text variant="titleSmall">Attachments</Text>
        {(files.data ?? []).map((file) => file.url ? <Image key={file.id} source={{ uri: file.url }} style={styles.photo} /> : <Text key={file.id}>{file.file_name}</Text>)}
        {!files.data?.length ? <Text>No attachments.</Text> : null}
        <Text variant="titleSmall">Messages</Text>
        {(messages.data ?? []).map((message) => <Text key={message.id}>{message.body}</Text>)}
        {!messages.data?.length ? <Text>No messages yet.</Text> : null}
        <TextInput label="Message" value={body} onChangeText={setBody} mode="outlined" />
        {actionMessage ? <Text style={styles.ok}>{actionMessage}</Text> : null}
        {sendError ? <Text style={styles.error}>{sendError}</Text> : null}
        <Button mode="contained" onPress={send}>Send</Button>
        {row?.status === 'completed' ? <Link href={`/(customer)/feedback/${id}`}>Leave feedback</Link> : null}
      </ScrollView>
    </ScreenBody>
  );
}

const styles = StyleSheet.create({ pad: { padding: 16, gap: 10 }, error: { color: '#EF4444' }, ok: { color: '#22C55E' }, photo: { width: '100%', height: 180, borderRadius: 8 } });
