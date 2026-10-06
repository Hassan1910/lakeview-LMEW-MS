import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import { DataState } from '../components/DataState';

export const Invoices: React.FC = () => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error: listError } = await db().from('invoices').select('id, code, status, total, balance, currency').order('created_at', { ascending: false });
      if (listError) throw listError;
      return data ?? [];
    },
  });
  const accepted = useQuery({
    queryKey: ['accepted-quotes'],
    queryFn: async () => {
      const { data, error: listError } = await db().from('quotations').select('id, code, total, currency, service_request_id').eq('status', 'accepted').order('created_at', { ascending: false });
      if (listError) throw listError;
      return data ?? [];
    },
  });
  const issue = async (quotationId: string) => {
    const { error: rpcError } = await db().rpc('issue_invoice_from_quotation', { p_quotation_id: quotationId });
    setError(rpcError?.message ?? null);
    setSuccess(rpcError ? null : 'Invoice issued');
    if (!rpcError) {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['accepted-quotes'] });
    }
  };
  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Issue from an accepted quotation</h2>
      {error ? <p className="text-red-600">{error}</p> : null}
      {success ? <p className="text-green-600">{success}</p> : null}
      {(accepted.data ?? []).length === 0 ? <p>No accepted quotations are waiting.</p> : (
        <ul className="space-y-2">
          {accepted.data?.map((quote) => (
            <li key={quote.id} className="flex items-center gap-3">
              <span>{quote.code} · {quote.total} {quote.currency}</span>
              <button className="rounded bg-[#0B4F6C] px-3 py-1 text-white" onClick={() => issue(quote.id)}>Issue invoice</button>
            </li>
          ))}
        </ul>
      )}
      <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!query.data?.length} emptyLabel="No invoices.">
        <ul>{query.data?.map((row) => <li key={row.id}>{row.code} · {row.status} · balance {row.balance} {row.currency}</li>)}</ul>
      </DataState>
    </div>
  );
};
