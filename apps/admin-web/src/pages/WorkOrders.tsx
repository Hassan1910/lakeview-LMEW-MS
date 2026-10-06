import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db, watch } from '../lib/supabase';
import { formatWhen, statusLabel } from '../lib/format';
import { DataState } from '../components/DataState';
import { useClientPage } from '../components/useClientPage';
import { Page, Pagination, SearchField, StatusBadge, Table, linkClass, tdClass } from '../components/ui';

export const WorkOrders: React.FC = () => {
  const queryClient = useQueryClient();
  const [term, setTerm] = useState('');
  const [status, setStatus] = useState('');
  const query = useQuery({
    queryKey: ['work-orders'],
    queryFn: async () => {
      const { data, error } = await db().from('work_orders').select('id, code, status, scheduled_start').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => watch('work_orders', () => queryClient.invalidateQueries({ queryKey: ['work-orders'] })), [queryClient]);
  const statuses = useMemo(() => [...new Set((query.data ?? []).map((row) => row.status).filter(Boolean))], [query.data]);
  const rows = useMemo(() => (query.data ?? []).filter((row) => {
    if (status && row.status !== status) return false;
    return `${row.code ?? ''} ${row.status ?? ''}`.toLowerCase().includes(term.trim().toLowerCase());
  }), [query.data, status, term]);
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
      </div>
      <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!rows.length} emptyLabel={term || status ? 'No work orders match those filters.' : 'No work orders yet.'}>
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
