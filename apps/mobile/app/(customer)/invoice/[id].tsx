import React from 'react';
import { Text } from 'react-native-paper';
import { Link, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../../src/lib/db';
import { ScreenBody } from '../../../src/components/ScreenBody';

export default function InvoiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const { data, error } = await db().from('invoices').select('*, payments(id, amount, status, method, reference)').eq('id', id).single();
      if (error) throw error;
      return data;
    },
  });
  const invoice = query.data;
  return (
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null}>
      <Text variant="titleLarge">{invoice?.code}</Text>
      <Text>Status {invoice?.status}</Text>
      <Text>Total {invoice?.total} · paid {invoice?.amount_paid} · balance {invoice?.balance}</Text>
      {(invoice?.payments ?? []).map((payment: { id: string; amount: number; status: string; method: string; reference: string | null }) => (
        <Text key={payment.id}>{payment.method} {payment.amount} {payment.status} {payment.reference}</Text>
      ))}
      <Link href={`/(customer)/pay/${id}`}>Pay this invoice</Link>
    </ScreenBody>
  );
}
