import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { Button, Card, Field, Notice, Page, Table, errorMessage, inputClass } from '../components/ui';

export const InventoryDetail: React.FC = () => {
  const { id } = useParams();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ location: '', reorderLevel: '', unitPrice: '', unitCost: '', isActive: true });
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const item = useQuery({
    queryKey: ['inventory-item', id],
    queryFn: async () => {
      const { data, error } = await db().from('inventory_items').select('*, category:inventory_categories(name)').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const movements = useQuery({
    queryKey: ['inventory-item-movements', id],
    enabled: can('stock_movements.view'),
    queryFn: async () => {
      const { data, error } = await db().from('stock_movements').select('id, created_at, type, quantity, reason, reference').eq('inventory_item_id', id).order('created_at', { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!item.data) return;
    setForm({
      location: item.data.location ?? '',
      reorderLevel: String(item.data.reorder_level ?? 0),
      unitPrice: String(item.data.unit_price ?? 0),
      unitCost: String(item.data.unit_cost ?? 0),
      isActive: item.data.is_active ?? true,
    });
  }, [item.data]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const numbers = [form.reorderLevel, form.unitPrice, form.unitCost].map(Number);
    if (numbers.some((value) => Number.isNaN(value) || value < 0)) return setMessage({ tone: 'error', text: 'Numbers must be zero or more.' });
    const { error } = await db().from('inventory_items').update({
      location: form.location.trim() || null,
      reorder_level: numbers[0],
      unit_price: numbers[1],
      unit_cost: numbers[2],
      is_active: form.isActive,
    }).eq('id', id);
    setMessage(error ? { tone: 'error', text: error.message } : { tone: 'success', text: 'Saved.' });
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['inventory-item', id] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock-count'] });
    }
  };

  const row = item.data;
  const category = row ? (Array.isArray(row.category) ? row.category[0] : row.category) : null;
  const editable = can('inventory.edit');

  return (
    <DataState loading={item.isLoading} error={errorMessage(item.error)} empty={!row} emptyLabel="Item not found or not visible to your role.">
      {row ? (
        <Page title={row.name} description={`SKU ${row.sku} · ${category?.name ?? 'Uncategorised'}`} actions={<Link className="text-sm text-[#0B4F6C] hover:underline dark:text-sky-300" to="/inventory">Back to inventory</Link>}>
          <div className="grid gap-4 md:grid-cols-3">
            <Card title="On hand"><p className="text-3xl font-semibold">{row.quantity_on_hand} <span className="text-base font-normal text-slate-500">{row.unit}</span></p><p className="text-sm text-slate-500">Reorder at {row.reorder_level}</p></Card>
            <Card title="Pricing"><p>Cost KES {Number(row.unit_cost ?? 0).toLocaleString()}</p><p>Price KES {Number(row.unit_price ?? 0).toLocaleString()}</p></Card>
            <Card title="Location"><p>{row.location ?? 'Not set'}</p>{row.description ? <p className="mt-2 text-sm text-slate-500">{row.description}</p> : null}</Card>
          </div>
          {editable ? (
            <Card title="Edit item">
              <form className="grid gap-3 md:grid-cols-5" onSubmit={save}>
                <Field label="Location"><input className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
                <Field label="Reorder level"><input className={inputClass} value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} /></Field>
                <Field label="Unit cost"><input className={inputClass} value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} /></Field>
                <Field label="Unit price"><input className={inputClass} value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} /></Field>
                <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
                <div><Button type="submit">Save changes</Button></div>
              </form>
              {message ? <div className="mt-3"><Notice tone={message.tone}>{message.text}</Notice></div> : null}
            </Card>
          ) : null}
          {can('stock_movements.view') ? (
            <Card title="Recent movements">
              <DataState loading={movements.isLoading} error={errorMessage(movements.error)} empty={!movements.data?.length} emptyLabel="No movements for this item.">
                <Table head={['When', 'Type', 'Qty', 'Reason', 'Reference']}>
                  {(movements.data ?? []).map((movement) => (
                    <tr key={movement.id}>
                      <td className="px-3 py-2">{new Date(movement.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2">{movement.type}</td>
                      <td className="px-3 py-2">{movement.quantity}</td>
                      <td className="px-3 py-2">{movement.reason ?? '—'}</td>
                      <td className="px-3 py-2">{movement.reference ?? '—'}</td>
                    </tr>
                  ))}
                </Table>
              </DataState>
            </Card>
          ) : null}
        </Page>
      ) : null}
    </DataState>
  );
};
