import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { db, watch } from '../lib/supabase';
import { DataState } from '../components/DataState';

type Row = { id: string; code: string | null; title: string; status: string; category: string; priority: string; created_at: string };

const helper = createColumnHelper<Row>();

export const ServiceRequests: React.FC = () => {
  const [params] = useSearchParams();
  const [status, setStatus] = useState('');
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
      const q = params.get('q');
      if (q) request = request.or(`title.ilike.%${q}%,code.ilike.%${q}%`);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  useEffect(() => watch('service_requests', () => queryClient.invalidateQueries({ queryKey: ['admin-requests'] })), [queryClient]);
  const columns = useMemo(() => [
    helper.accessor('code', { header: 'Code', cell: (info) => <Link className="text-[#0B4F6C]" to={`/service-requests/${info.row.original.id}`}>{info.getValue()}</Link> }),
    helper.accessor('title', { header: 'Title' }),
    helper.accessor('status', { header: 'Status' }),
    helper.accessor('category', { header: 'Category' }),
    helper.accessor('priority', { header: 'Priority' }),
  ], []);
  const table = useReactTable({ data: query.data ?? [], columns, getCoreRowModel: getCoreRowModel() });
  return (
    <div>
      <div className="mb-3 flex gap-2">
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded border px-2 py-1"><option value="">Status</option>{['request_received','inspection_in_progress','quotation_pending','quotation_sent','awaiting_approval','awaiting_spare_parts','under_repair','testing','completed','cancelled'].map((item) => <option key={item}>{item}</option>)}</select>
        <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded border px-2 py-1"><option value="">Category</option>{['boat_repair','ship_repair','engine_maintenance','fabrication','electrical','welding','equipment_supply','consultation','other'].map((item) => <option key={item}>{item}</option>)}</select>
        <select value={priority} onChange={(event) => setPriority(event.target.value)} className="rounded border px-2 py-1"><option value="">Priority</option>{['low','medium','high','urgent'].map((item) => <option key={item}>{item}</option>)}</select>
        <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded border px-2 py-1" />
      </div>
      <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!query.data?.length} emptyLabel="No service requests match.">
        <table className="w-full bg-white text-sm dark:bg-slate-900">
          <thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id} className="p-2 text-left">{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}</thead>
          <tbody>{table.getRowModel().rows.map((row) => <tr key={row.id} className="border-t">{row.getVisibleCells().map((cell) => <td key={cell.id} className="p-2">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody>
        </table>
      </DataState>
    </div>
  );
};
