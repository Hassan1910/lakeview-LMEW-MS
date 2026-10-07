import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db, watch } from '../lib/supabase';
import { formatWhen, sanitizeSearchTerm, statusLabel } from '../lib/format';
import { DataState } from '../components/DataState';
import { useClientPage } from '../components/useClientPage';
import { Page, Pagination, StatusBadge, Table, inputClass, linkClass, tdClass } from '../components/ui';

type Row = { id: string; code: string | null; title: string; status: string; category: string; priority: string; created_at: string };

const STATUSES = ['request_received', 'inspection_in_progress', 'quotation_pending', 'quotation_sent', 'awaiting_approval', 'awaiting_spare_parts', 'under_repair', 'testing', 'completed', 'cancelled'];
const CATEGORIES = ['boat_repair', 'ship_repair', 'engine_maintenance', 'fabrication', 'electrical', 'welding', 'equipment_supply', 'consultation', 'other'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export const ServiceRequests: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const statusParam = params.get('status') ?? '';
  const status = STATUSES.includes(statusParam) ? statusParam : '';
  const setStatus = (value: string) => {
    const next = new URLSearchParams(params);
    if (value && STATUSES.includes(value)) next.set('status', value);
    else next.delete('status');
    setParams(next, { replace: true });
  };
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [from, setFrom] = useState('');
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin-requests', status, category, priority, from, params.get('q')],
    queryFn: async () => {
      let request = db().from('service_requests').select('id, code, title, status, category, priority, created_at').order('created_at', { ascending: false });
      if (status) request = request.eq('status', status);
      if (category) request = request.eq('category', category);
      if (priority) request = request.eq('priority', priority);
      if (from) request = request.gte('created_at', from);
      const q = sanitizeSearchTerm(params.get('q') ?? '');
      if (q) request = request.or(`title.ilike.%${q}%,code.ilike.%${q}%`);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  useEffect(() => watch('service_requests', () => queryClient.invalidateQueries({ queryKey: ['admin-requests'] })), [queryClient]);
  const page = useClientPage(query.data ?? []);
  const filters: [string, string, (value: string) => void, readonly string[]][] = [
    ['Status', status, setStatus, STATUSES],
    ['Category', category, setCategory, CATEGORIES],
    ['Priority', priority, setPriority, PRIORITIES],
  ];

  return (
    <Page title="Service requests" description="Incoming work, from first contact through completion.">
      <div className="flex flex-wrap gap-2">
        {filters.map(([label, value, setter, options]) => (
          <label key={label} className="text-sm">
            <span className="sr-only">{label}</span>
            <select className={`${inputClass} w-auto`} value={value} onChange={(event) => { setter(event.target.value); page.setPage(1); }}>
              <option value="">{label}</option>
              {options.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
            </select>
          </label>
        ))}
        <label className="text-sm">
          <span className="sr-only">From date</span>
          <input type="date" aria-label="From date" value={from} onChange={(event) => { setFrom(event.target.value); page.setPage(1); }} className={`${inputClass} w-auto`} />
        </label>
      </div>
      <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!query.data?.length} emptyLabel="No service requests match.">
        <Table head={['Code', 'Title', 'Status', { content: 'Category', className: 'hidden md:table-cell' }, { content: 'Priority', className: 'hidden lg:table-cell' }, { content: 'Opened', className: 'hidden sm:table-cell' }]}>
          {page.slice.map((row) => (
            <tr key={row.id}>
              <td className={tdClass}><Link className={linkClass} to={`/service-requests/${row.id}`}>{row.code ?? 'Request'}</Link></td>
              <td className={tdClass}>{row.title}</td>
              <td className={tdClass}><StatusBadge status={row.status} /></td>
              <td className={`${tdClass} hidden md:table-cell`}>{statusLabel(row.category)}</td>
              <td className={`${tdClass} hidden lg:table-cell`}>{statusLabel(row.priority)}</td>
              <td className={`${tdClass} hidden sm:table-cell`}>{formatWhen(row.created_at)}</td>
            </tr>
          ))}
        </Table>
        <Pagination page={page.page} pageCount={page.pageCount} total={page.total} onPage={page.setPage} />
      </DataState>
    </Page>
  );
}
