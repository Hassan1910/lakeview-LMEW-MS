import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db, watch } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { formatMoney, statusLabel } from '../lib/format';
import { useConfirm } from '../components/confirm';
import { DataState } from '../components/DataState';
import { useClientPage } from '../components/useClientPage';
import { Button, Card, Field, Notice, Page, Pagination, SearchField, StatusBadge, Table, inputClass, tdClass } from '../components/ui';

const METHODS = ['cash', 'bank_transfer', 'cheque', 'mpesa', 'card'];

export const Payments: React.FC = () => {
  const { profile, can } = useAuth();
  const canRecord = can('payments.create');
  const canApprove = can('payments.approve');
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [form, setForm] = useState({ invoice_id: '', amount: '', method: 'cash' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [term, setTerm] = useState('');
  const query = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const { data, error: listError } = await db().from('payments').select('id, invoice_id, amount, method, status, reference').order('created_at', { ascending: false });
      if (listError) throw listError;
      return data ?? [];
    },
  });
  const invoices = useQuery({
    queryKey: ['invoice-options'],
    queryFn: async () => {
      const { data, error: listError } = await db().from('invoices').select('id, code, balance, currency, status').order('created_at', { ascending: false });
      if (listError) throw listError;
      return data ?? [];
    },
  });
  useEffect(() => watch('payments', () => queryClient.invalidateQueries({ queryKey: ['payments'] })), [queryClient]);

  const invoiceById = useMemo(() => new Map((invoices.data ?? []).map((row) => [row.id, row])), [invoices.data]);

  const setStatus = async (id: string, status: 'confirmed' | 'refunded') => {
    const ok = await confirm({
      title: status === 'refunded' ? 'Refund payment' : 'Verify payment',
      description: status === 'refunded' ? 'Mark this payment as refunded?' : 'Confirm this payment has been received?',
      confirmLabel: status === 'refunded' ? 'Refund' : 'Verify',
      tone: status === 'refunded' ? 'danger' : 'primary',
    });
    if (!ok) return;
    const { data, error: updateError } = await db().from('payments').update({ status, paid_at: new Date().toISOString() }).eq('id', id).select('id');
    const failure = updateError?.message ?? (data?.length ? null : 'That payment could not be updated.');
    setError(failure);
    setSuccess(failure ? null : status === 'refunded' ? 'Payment refunded.' : 'Payment verified.');
    queryClient.invalidateQueries({ queryKey: ['payments'] });
  };
  const record = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!form.invoice_id) return setError('Choose an invoice.');
    if (!form.amount || Number(form.amount) <= 0) return setError('Enter an amount greater than zero.');
    setSaving(true);
    const { error: insertError } = await db().from('payments').insert({
      invoice_id: form.invoice_id,
      amount: Number(form.amount),
      currency: invoiceById.get(form.invoice_id)?.currency ?? 'KES',
      method: form.method,
      status: 'confirmed',
      paid_at: new Date().toISOString(),
      recorded_by: profile?.id,
    });
    setSaving(false);
    setError(insertError?.message ?? null);
    setSuccess(insertError ? null : 'Manual payment recorded.');
    if (!insertError) {
      setForm({ invoice_id: '', amount: '', method: 'cash' });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    }
  };
  const rows = useMemo(() => (query.data ?? []).filter((row) => {
    const invoice = invoiceById.get(row.invoice_id);
    return `${invoice?.code ?? ''} ${row.method} ${row.status} ${row.reference ?? ''}`.toLowerCase().includes(term.trim().toLowerCase());
  }), [query.data, term, invoiceById]);
  const page = useClientPage(rows);

  return (
    <Page title="Payments" description="Record cash and transfer receipts, then verify or refund them.">
      {canRecord ? <Card title="Record a payment">
        <form className="grid gap-3 md:grid-cols-4" onSubmit={record}>
          <Field label="Invoice" required>
            <select className={inputClass} value={form.invoice_id} onChange={(event) => setForm({ ...form, invoice_id: event.target.value })}>
              <option value="">Choose an invoice…</option>
              {(invoices.data ?? []).filter((invoice) => Number(invoice.balance) > 0 && !['paid', 'cancelled', 'draft'].includes(invoice.status)).map((invoice) => (
                <option key={invoice.id} value={invoice.id}>{invoice.code} · balance {formatMoney(invoice.balance, invoice.currency ?? 'KES')}</option>
              ))}
            </select>
          </Field>
          <Field label="Amount" required>
            <input className={inputClass} inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
          </Field>
          <Field label="Method" required>
            <select className={inputClass} value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>
              {METHODS.map((method) => <option key={method} value={method}>{statusLabel(method)}</option>)}
            </select>
          </Field>
          <div className="flex items-end"><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Record payment'}</Button></div>
        </form>
      </Card> : null}
      <Notice tone="error">{error}</Notice>
      <Notice tone="success">{success}</Notice>
      <SearchField value={term} onChange={(value) => { setTerm(value); page.setPage(1); }} placeholder="Search invoice, method, or reference" />
      <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!rows.length} emptyLabel={term ? 'No payments match that search.' : 'No payments yet.'}>
        <Table head={['Invoice', 'Method', 'Amount', 'Status', '']}>
          {page.slice.map((row) => (
            <tr key={row.id}>
              <td className={tdClass}>{invoiceById.get(row.invoice_id)?.code ?? 'Invoice'}</td>
              <td className={tdClass}>{statusLabel(row.method)}{row.reference ? <span className="block text-xs text-slate-500">{row.reference}</span> : null}</td>
              <td className={tdClass}>{formatMoney(row.amount)}</td>
              <td className={tdClass}><StatusBadge status={row.status} /></td>
              <td className={`${tdClass} text-right`}>
                {canApprove && row.status === 'pending' ? <Button onClick={() => setStatus(row.id, 'confirmed')}>Verify</Button> : null}
                {canApprove && row.status === 'confirmed' ? <Button variant="secondary" onClick={() => setStatus(row.id, 'refunded')}>Refund</Button> : null}
              </td>
            </tr>
          ))}
        </Table>
        <Pagination page={page.page} pageCount={page.pageCount} total={page.total} onPage={page.setPage} />
      </DataState>
    </Page>
  );
};
