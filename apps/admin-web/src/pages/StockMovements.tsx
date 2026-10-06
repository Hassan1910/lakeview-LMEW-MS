import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { Badge, Button, Card, Field, Notice, Page, Table, errorMessage, inputClass } from '../components/ui';

const TYPES = ['in', 'out', 'adjustment', 'return'] as const;

export const StockMovements: React.FC = () => {
  const { can, profile } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ itemId: '', type: 'in', quantity: '1', reason: '', reference: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const items = useQuery({
    queryKey: ['inventory-options'],
    queryFn: async () => {
      const { data, error: listError } = await db().from('inventory_items').select('id, name, sku, quantity_on_hand').eq('is_active', true).order('name');
      if (listError) throw listError;
      return data ?? [];
    },
  });
  const movements = useQuery({
    queryKey: ['movements'],
    queryFn: async () => {
      const { data, error: listError } = await db()
        .from('stock_movements')
        .select('id, created_at, type, quantity, reason, reference, item:inventory_items(name, sku), actor:profiles!stock_movements_created_by_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (listError) throw listError;
      return data ?? [];
    },
  });

  const record = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const quantity = Number(form.quantity);
    if (!form.itemId) return setError('Choose an item.');
    if (!Number.isFinite(quantity) || quantity === 0) return setError('Enter a quantity.');
    if (form.type !== 'adjustment' && quantity < 0) return setError('Only adjustments can be negative.');
    const { error: insertError } = await db().from('stock_movements').insert({
      inventory_item_id: form.itemId,
      type: form.type,
      quantity,
      reason: form.reason.trim() || null,
      reference: form.reference.trim() || null,
      created_by: profile?.id,
    });
    if (insertError) return setError(insertError.message);
    setSuccess('Movement recorded and stock updated.');
    setForm({ ...form, quantity: '1', reason: '', reference: '' });
    for (const key of ['movements', 'inventory', 'inventory-options', 'low-stock-count']) queryClient.invalidateQueries({ queryKey: [key] });
  };

  return (
    <Page title="Stock movements" description="Every stock change: receipts, issues to jobs, adjustments, and returns.">
      {can('stock_movements.create') ? (
        <Card title="Record a movement">
          <form className="grid gap-3 md:grid-cols-6" onSubmit={record}>
            <div className="md:col-span-2">
              <Field label="Item">
                <select className={inputClass} value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })}>
                  <option value="">Choose an item…</option>
                  {(items.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.sku}) · {item.quantity_on_hand} on hand</option>)}
                </select>
              </Field>
            </div>
            <Field label="Type">
              <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </Field>
            <Field label="Quantity" hint={form.type === 'adjustment' ? 'Negative to reduce stock' : undefined}><input className={inputClass} inputMode="decimal" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
            <Field label="Reason"><input className={inputClass} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
            <Field label="Reference"><input className={inputClass} placeholder="GRN, job card…" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></Field>
            <div><Button type="submit">Record</Button></div>
          </form>
          <div className="mt-3 space-y-2"><Notice tone="error">{error}</Notice><Notice tone="success">{success}</Notice></div>
        </Card>
      ) : null}
      <DataState loading={movements.isLoading} error={errorMessage(movements.error)} empty={!movements.data?.length} emptyLabel="No movements recorded yet.">
        <Table head={['When', 'Item', 'Type', 'Qty', 'Reason', 'Reference', 'By']}>
          {(movements.data ?? []).map((row) => {
            const item = Array.isArray(row.item) ? row.item[0] : row.item;
            const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;
            return (
              <tr key={row.id}>
                <td className="px-3 py-2 whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">{item?.name ?? '—'} <span className="font-mono text-xs text-slate-500">{item?.sku}</span></td>
                <td className="px-3 py-2"><Badge tone={row.type === 'in' || row.type === 'return' ? 'green' : row.type === 'out' ? 'amber' : 'blue'}>{row.type}</Badge></td>
                <td className="px-3 py-2">{row.quantity}</td>
                <td className="px-3 py-2">{row.reason ?? '—'}</td>
                <td className="px-3 py-2">{row.reference ?? '—'}</td>
                <td className="px-3 py-2">{actor?.full_name ?? '—'}</td>
              </tr>
            );
          })}
        </Table>
      </DataState>
    </Page>
  );
};
