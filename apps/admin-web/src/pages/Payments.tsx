import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db, watch } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';

export const Payments: React.FC = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ invoice_id: '', amount: '', method: 'cash' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const { data, error: listError } = await db().from('payments').select('id, invoice_id, amount, method, status, reference').order('created_at', { ascending: false });
      if (listError) throw listError;
      return data ?? [];
    },
  });
  useEffect(() => watch('payments', () => queryClient.invalidateQueries({ queryKey: ['payments'] })), [queryClient]);

  const setStatus = async (id: string, status: 'confirmed' | 'refunded') => {
    const { error: updateError } = await db().from('payments').update({ status, paid_at: new Date().toISOString() }).eq('id', id);
    setError(updateError?.message ?? null);
    setSuccess(updateError ? null : `Marked ${status}`);
  };
  const record = async () => {
    const { error: insertError } = await db().from('payments').insert({
      invoice_id: form.invoice_id,
      amount: Number(form.amount),
      method: form.method,
      status: 'confirmed',
      paid_at: new Date().toISOString(),
      recorded_by: profile?.id,
    });
    setError(insertError?.message ?? null);
    setSuccess(insertError ? null : 'Manual payment recorded');
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input className="rounded border p-2" placeholder="Invoice id" value={form.invoice_id} onChange={(event) => setForm({ ...form, invoice_id: event.target.value })} />
        <input className="rounded border p-2" placeholder="Amount" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
        <select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })} className="rounded border p-2">
          {['cash', 'bank_transfer', 'cheque', 'mpesa', 'card'].map((method) => <option key={method}>{method}</option>)}
        </select>
        <button className="rounded bg-[#0B4F6C] px-3 text-white" onClick={record}>Record</button>
      </div>
      {error ? <p className="text-red-600">{error}</p> : null}
      {success ? <p className="text-green-600">{success}</p> : null}
      <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!query.data?.length} emptyLabel="No payments.">
        <ul className="space-y-2">
          {query.data?.map((row) => (
            <li key={row.id} className="flex items-center gap-2">
              <span>{row.method} {row.amount} · {row.status} · {row.reference}</span>
              {row.status === 'pending' ? <button onClick={() => setStatus(row.id, 'confirmed')}>Verify</button> : null}
              {row.status === 'confirmed' ? <button onClick={() => setStatus(row.id, 'refunded')}>Refund</button> : null}
            </li>
          ))}
        </ul>
      </DataState>
    </div>
  );
};
