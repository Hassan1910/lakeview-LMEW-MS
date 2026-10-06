import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { Badge, Button, Card, Field, Notice, Page, Table, errorMessage, inputClass, statusTone } from '../components/ui';

export const PurchaseOrders: React.FC = () => {
  const { can, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ supplierId: '', expectedDate: '', notes: '' });
  const [error, setError] = useState<string | null>(null);

  const suppliers = useQuery({
    queryKey: ['supplier-options'],
    enabled: can('purchase_orders.create'),
    queryFn: async () => {
      const { data, error: listError } = await db().from('suppliers').select('id, name').eq('is_active', true).order('name');
      if (listError) throw listError;
      return data ?? [];
    },
  });
  const query = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: async () => {
      const { data, error: listError } = await db()
        .from('purchase_orders')
        .select('id, code, status, total, currency, expected_date, created_at, supplier:suppliers(name)')
        .order('created_at', { ascending: false });
      if (listError) throw listError;
      return data ?? [];
    },
  });

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!form.supplierId) return setError('Choose a supplier.');
    const { data, error: insertError } = await db().from('purchase_orders').insert({
      supplier_id: form.supplierId,
      notes: form.notes.trim() || null,
      expected_date: form.expectedDate || null,
      created_by: profile?.id,
      status: 'draft',
    }).select('id').single();
    if (insertError) return setError(insertError.message);
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    navigate(`/purchase-orders/${data.id}`);
  };

  return (
    <Page title="Purchase orders" description="Draft, approve, send, and receive orders from suppliers.">
      {can('purchase_orders.create') ? (
        <Card title="New draft order">
          <form className="grid gap-3 md:grid-cols-4" onSubmit={create}>
            <Field label="Supplier">
              <select className={inputClass} value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                <option value="">Choose a supplier…</option>
                {(suppliers.data ?? []).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
            </Field>
            <Field label="Expected delivery"><input className={inputClass} type="date" value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })} /></Field>
            <Field label="Notes"><input className={inputClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <div className="flex items-end"><Button type="submit">Create draft</Button></div>
          </form>
          <div className="mt-3"><Notice tone="error">{error}</Notice></div>
        </Card>
      ) : null}
      <DataState loading={query.isLoading} error={errorMessage(query.error)} empty={!query.data?.length} emptyLabel="No purchase orders yet.">
        <Table head={['Code', 'Supplier', 'Status', 'Total', 'Expected', 'Created']}>
          {(query.data ?? []).map((row) => {
            const supplier = Array.isArray(row.supplier) ? row.supplier[0] : row.supplier;
            return (
              <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                <td className="px-3 py-2"><Link className="font-medium text-[#0B4F6C] hover:underline dark:text-sky-300" to={`/purchase-orders/${row.id}`}>{row.code ?? 'Draft'}</Link></td>
                <td className="px-3 py-2">{supplier?.name ?? '—'}</td>
                <td className="px-3 py-2"><Badge tone={statusTone(row.status)}>{row.status}</Badge></td>
                <td className="px-3 py-2">{row.currency ?? 'KES'} {Number(row.total ?? 0).toLocaleString()}</td>
                <td className="px-3 py-2">{row.expected_date ?? '—'}</td>
                <td className="px-3 py-2">{new Date(row.created_at).toLocaleDateString()}</td>
              </tr>
            );
          })}
        </Table>
      </DataState>
    </Page>
  );
};
