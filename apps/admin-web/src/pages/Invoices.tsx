import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { formatMoney, statusLabel } from '../lib/format';
import { useConfirm } from '../components/confirm';
import { DataState } from '../components/DataState';
import { useClientPage } from '../components/useClientPage';
import { Button, Card, Notice, Page, Pagination, SearchField, StatusBadge, Table, linkClass, tdClass } from '../components/ui';

const INVOICE_STATUSES = ['draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled'];
const UNPAID = new Set(['issued', 'partially_paid', 'overdue']);

export const Invoices: React.FC = () => {
  const { can } = useAuth();
  const canIssue = can('invoices.approve');
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState('');
  const view = params.get('unpaid') === '1' ? 'unpaid' : (params.get('status') ?? '');
  const setView = (value: string) => {
    const next = new URLSearchParams(params);
    next.delete('unpaid');
    next.delete('status');
    if (value === 'unpaid') next.set('unpaid', '1');
    else if (value) next.set('status', value);
    setParams(next, { replace: true });
  };
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
    enabled: canIssue,
    queryFn: async () => {
      const { data, error: listError } = await db().from('quotations').select('id, code, total, currency, service_request_id').eq('status', 'accepted').order('created_at', { ascending: false });
      if (listError) throw listError;
      return data ?? [];
    },
  });
  const issue = async (quotationId: string, code: string | null) => {
    const ok = await confirm({
      title: 'Issue invoice',
      description: `Create an invoice from quotation ${code ?? ''}?`.trim(),
      confirmLabel: 'Issue invoice',
      tone: 'primary',
    });
    if (!ok) return;
    setBusy(quotationId);
    const { error: rpcError } = await db().rpc('issue_invoice_from_quotation', { p_quotation_id: quotationId });
    setBusy(null);
    setError(rpcError?.message ?? null);
    setSuccess(rpcError ? null : 'Invoice issued.');
    if (!rpcError) {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['accepted-quotes'] });
    }
  };
  const rows = useMemo(() => (query.data ?? []).filter((row) => {
    if (view === 'unpaid' && !UNPAID.has(row.status ?? '')) return false;
    if (view && view !== 'unpaid' && row.status !== view) return false;
    return `${row.code ?? ''} ${row.status ?? ''}`.toLowerCase().includes(term.trim().toLowerCase());
  }), [query.data, term, view]);
  const page = useClientPage(rows);

  return (
    <Page title="Invoices" description="Issue invoices from accepted quotations and review balances.">
      <Notice tone="error">{error}</Notice>
      <Notice tone="success">{success}</Notice>
      {canIssue ? <Card title="Accepted quotations">
        {(accepted.data ?? []).length === 0 ? <p className="text-sm text-slate-500">No accepted quotations are waiting.</p> : (
          <ul className="space-y-2">
            {accepted.data?.map((quote) => (
              <li key={quote.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{quote.code} · {formatMoney(quote.total, quote.currency ?? 'KES')}</span>
                <Button disabled={busy === quote.id} onClick={() => issue(quote.id, quote.code)}>{busy === quote.id ? 'Issuing…' : 'Issue invoice'}</Button>
              </li>
            ))}
          </ul>
        )}
      </Card> : null}
      <div className="flex flex-wrap items-center gap-2">
        <SearchField value={term} onChange={(value) => { setTerm(value); page.setPage(1); }} placeholder="Search invoice code or status" />
        <label className="text-sm">
          <span className="sr-only">Invoice status</span>
          <select className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950" value={INVOICE_STATUSES.includes(view) || view === 'unpaid' ? view : ''} onChange={(event) => { setView(event.target.value); page.setPage(1); }}>
            <option value="">All invoices</option>
            <option value="unpaid">Unpaid</option>
            {INVOICE_STATUSES.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
          </select>
        </label>
      </div>
      <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!rows.length} emptyLabel={term || view ? 'No invoices match that filter.' : 'No invoices yet.'}>
        <Table head={['Invoice', 'Status', 'Total', { content: 'Balance', className: 'hidden sm:table-cell' }]}>
          {page.slice.map((row) => (
            <tr key={row.id}>
              <td className={`${tdClass} font-medium`}><Link className={linkClass} to={`/invoices/${row.id}`}>{row.code}</Link></td>
              <td className={tdClass}><StatusBadge status={row.status} /></td>
              <td className={tdClass}>{formatMoney(row.total, row.currency ?? 'KES')}</td>
              <td className={`${tdClass} hidden sm:table-cell`}>{formatMoney(row.balance, row.currency ?? 'KES')}</td>
            </tr>
          ))}
        </Table>
        <Pagination page={page.page} pageCount={page.pageCount} total={page.total} onPage={page.setPage} />
      </DataState>
    </Page>
  );
};
