import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db, watch } from '../lib/supabase';
import { formatWhen, statusLabel } from '../lib/format';
import { DataState } from '../components/DataState';
import { useClientPage } from '../components/useClientPage';
import { Page, Pagination, SearchField, StatusBadge, Table, linkClass, tdClass } from '../components/ui';

const ACTIVE_JOBS = new Set(['assigned', 'in_progress', 'blocked']);

export const WorkOrders: React.FC = () => {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState('');
  const status = params.get('status') ?? '';
  const overdueOnly = params.get('overdue') === '1';
  const setStatus = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('status', value);
    else next.delete('status');
    setParams(next, { replace: true });
  };
  const setOverdueOnly = (value: boolean) => {
    const next = new URLSearchParams(params);
    if (value) next.set('overdue', '1');
    else next.delete('overdue');
    setParams(next, { replace: true });
  };
  const query = useQuery({
    queryKey: ['work-orders'],
    queryFn: async () => {
      const { data, error } = await db().from('work_orders').select('id, code, status, scheduled_start, scheduled_end').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => watch('work_orders', () => queryClient.invalidateQueries({ queryKey: ['work-orders'] })), [queryClient]);
  const statuses = useMemo(() => {
    const values = [...new Set((query.data ?? []).map((row) => row.status).filter(Boolean))];
    if (status && !values.includes(status)) values.unshift(status);
    return values;
  }, [query.data, status]);
  const rows = useMemo(() => (query.data ?? []).filter((row) => {
    if (overdueOnly) {
      if (!ACTIVE_JOBS.has(row.status ?? '')) return false;
      if (!row.scheduled_end || new Date(row.scheduled_end).getTime() >= Date.now()) return false;
    }
    if (status && row.status !== status) return false;
    return `${row.code ?? ''} ${row.status ?? ''}`.toLowerCase().includes(term.trim().toLowerCase());
  }), [query.data, status, term, overdueOnly]);
  const page = useClientPage(rows);

  return (
    <Page title="Work orders" description="Jobs created from service requests.">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField value={term} onChange={(value) => { setTerm(value); page.setPage(1); }} placeholder="Search job code" />
        <label className="text-sm">
          <span className="sr-only">Status</span>
          <select className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950" value={status} onChange={(event) => { setStatus(event.target.value); page.setPage(1); }}>
            <option value="">All statuses</option>
            {statuses.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={overdueOnly} onChange={(event) => { setOverdueOnly(event.target.checked); page.setPage(1); }} />
          Overdue only
        </label>
      </div>
      <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!rows.length} emptyLabel={term || status || overdueOnly ? 'No work orders match those filters.' : 'No work orders yet.'}>
        <Table head={['Job', 'Status', { content: 'Scheduled', className: 'hidden sm:table-cell' }]}>
          {page.slice.map((row) => (
            <tr key={row.id}>
              <td className={tdClass}><Link className={linkClass} to={`/work-orders/${row.id}`}>{row.code ?? 'Work order'}</Link></td>
              <td className={tdClass}><StatusBadge status={row.status} /></td>
              <td className={`${tdClass} hidden sm:table-cell`}>{formatWhen(row.scheduled_start)}</td>
            </tr>
          ))}
        </Table>
        <Pagination page={page.page} pageCount={page.pageCount} total={page.total} onPage={page.setPage} />
      </DataState>
    </Page>
  );
};
