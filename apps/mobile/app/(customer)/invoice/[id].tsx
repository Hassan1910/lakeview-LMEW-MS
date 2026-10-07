import React, { useState } from 'react';
import { Text, Button } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../../src/lib/db';
import { ScreenBody } from '../../../src/components/ScreenBody';
import { FieldLine, Notice, Page } from '../../../src/components/ui';
import { formatWhen, isPayableStatus, labelize, money, one, readFunctionError } from '../../../src/lib/format';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { ui } from '../../../src/theme';

type Payment = { id: string; amount: number; status: string; method: string; reference: string | null };

export default function InvoiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ['invoice', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error: queryError } = await db().from('invoices').select('*, payments(id, amount, status, method, reference), request:service_requests(id, title, code)').eq('id', id).single();
      if (queryError) throw queryError;
      return data;
    },
  });
  const invoice = query.data;
  const request = one(invoice?.request);
  const payable = isPayableStatus(invoice?.status) && Number(invoice?.balance) > 0;

  const download = async () => {
    setBusy(true);
    setError(null);
    const { data, error: fnError } = await db().functions.invoke('generate-pdf', { body: { type: 'invoice', id } });
    setBusy(false);
    if (fnError || data?.error || !data?.signed_url) {
      setError(await readFunctionError(fnError, data));
      return;
    }
    await Linking.openURL(data.signed_url);
  };

  return (
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} onRetry={() => query.refetch()}>
      <Page>
        <Text style={ui.title}>{invoice?.code ?? 'Invoice'}</Text>
        <StatusBadge kind="invoice" status={invoice?.status} />
        <FieldLine label="Total" value={money(invoice?.total, invoice?.currency)} />
        <FieldLine label="Paid" value={money(invoice?.amount_paid, invoice?.currency)} />
        <FieldLine label="Balance" value={money(invoice?.balance, invoice?.currency)} />
        <FieldLine label="Issued" value={invoice?.issued_at ? formatWhen(invoice.issued_at, 'date') : invoice?.created_at ? formatWhen(invoice.created_at, 'date') : null} />
        <FieldLine label="Due" value={invoice?.due_at ? formatWhen(invoice.due_at, 'date') : 'No due date'} />
        <FieldLine label="Request" value={request ? [request.code, request.title].filter(Boolean).join(' · ') : null} />
        {request?.id ? <Button mode="text" onPress={() => router.push(`/(customer)/request/${request.id}`)}>View request</Button> : null}
        <Text style={ui.section}>Payments</Text>
        {((invoice?.payments ?? []) as Payment[]).length === 0 ? <Text style={ui.muted}>No payments recorded yet.</Text> : null}
        {((invoice?.payments ?? []) as Payment[]).map((payment) => (
          <Text key={payment.id} style={ui.body}>{labelize(payment.method)} · {money(payment.amount, invoice?.currency)} · {labelize(payment.status)}{payment.reference ? ` · ${payment.reference}` : ''}</Text>
        ))}
        {error ? <Notice tone="error" text={error} /> : null}
        <Button mode="outlined" icon="download" loading={busy} disabled={busy} onPress={download}>Download invoice</Button>
        {payable ? <Button mode="contained" onPress={() => router.push(`/(customer)/pay/${id}`)}>Pay this invoice</Button> : <Notice tone="info" text={invoice?.status === 'paid' ? 'This invoice is paid.' : 'This invoice is not open for payment.'} />}
      </Page>
    </ScreenBody>
  );
}
