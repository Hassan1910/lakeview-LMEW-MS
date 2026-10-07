import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { Badge, Button, Card, Field, Notice, Page, Table, errorMessage, inputClass } from '../components/ui';
import { downloadCsv } from '../lib/csv';

const blank = { name: '', sku: '', unitPrice: '', unitCost: '', reorderLevel: '', category: '', location: '' };

export const Inventory: React.FC = () => {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(blank);
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState('');
  const lowOnly = params.get('low') === '1';
  const setLowOnly = (value: boolean) => {
    const next = new URLSearchParams(params);
    if (value) next.set('low', '1');
    else next.delete('low');
    setParams(next, { replace: true });
  };
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const query = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const { data, error: listError } = await db()
        .from('inventory_items')
        .select('id, sku, name, quantity_on_hand, reorder_level, unit_price, unit_cost, location, is_active, category:inventory_categories(name)')
        .order('name');
      if (listError) throw listError;
      return data ?? [];
    },
  });

  const rows = (query.data ?? []).filter((row) => {
    const text = `${row.name} ${row.sku} ${row.location ?? ''}`.toLowerCase();
    if (filter && !text.includes(filter.toLowerCase())) return false;
    if (lowOnly && Number(row.quantity_on_hand) > Number(row.reorder_level)) return false;
    return true;
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const price = Number(form.unitPrice);
    const cost = Number(form.unitCost);
    const reorder = Number(form.reorderLevel);
    if (form.name.trim().length < 2 || form.sku.trim().length < 2) return setError('Name and SKU need at least two characters.');
    if ([price, cost, reorder].some((value) => Number.isNaN(value) || value < 0)) return setError('Price, cost, and reorder level must be zero or more.');
    if (form.category.trim().length < 2) return setError('Enter a category.');
    setSaving(true);
    try {
      const existing = await db().from('inventory_categories').select('id').eq('name', form.category.trim()).maybeSingle();
      let categoryId = existing.data?.id as string | undefined;
      if (!categoryId) {
        const created = await db().from('inventory_categories').insert({ name: form.category.trim() }).select('id').single();
        if (created.error) return setError(created.error.message);
        categoryId = created.data.id;
      }
      const { error: insertError } = await db().from('inventory_items').insert({
        name: form.name.trim(),
        sku: form.sku.trim(),
        unit_price: price,
        unit_cost: cost,
        reorder_level: reorder,
        location: form.location.trim() || null,
        category_id: categoryId,
      });
      if (insertError) return setError(insertError.message);
      setSuccess(`${form.name.trim()} added.`);
      setForm(blank);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock-count'] });
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => downloadCsv('inventory.csv', ['sku', 'name', 'category', 'on_hand', 'reorder_level', 'unit_cost', 'unit_price', 'location'], rows.map((row) => {
    const category = Array.isArray(row.category) ? row.category[0] : row.category;
    return [row.sku, row.name, category?.name, row.quantity_on_hand, row.reorder_level, row.unit_cost, row.unit_price, row.location];
  }));

  return (
    <Page
      title="Inventory"
      description="Spare parts, consumables, and stock levels."
      actions={can('inventory.export') ? <Button variant="secondary" onClick={exportCsv} disabled={!rows.length}>Export CSV</Button> : null}
    >
      {can('inventory.create') ? (
        <Card title="Add part">
          <form className="grid gap-3 md:grid-cols-4" onSubmit={submit}>
            <Field label="Name"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="SKU"><input className={inputClass} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
            <Field label="Category" hint="Created if it does not exist"><input className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
            <Field label="Location"><input className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
            <Field label="Unit cost (KES)"><input className={inputClass} inputMode="decimal" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} /></Field>
            <Field label="Unit price (KES)"><input className={inputClass} inputMode="decimal" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} /></Field>
            <Field label="Reorder level"><input className={inputClass} inputMode="numeric" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} /></Field>
            <div className="flex items-end"><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add part'}</Button></div>
          </form>
          <div className="mt-3 space-y-2"><Notice tone="error">{error}</Notice><Notice tone="success">{success}</Notice></div>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <input className={`${inputClass} max-w-xs`} placeholder="Filter by name, SKU, or bin" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> Low stock only</label>
      </div>

      <DataState loading={query.isLoading} error={errorMessage(query.error)} empty={!rows.length} emptyLabel={query.data?.length ? 'No items match the filter.' : 'No inventory items yet.'}>
        <Table head={['SKU', 'Name', 'Category', 'On hand', 'Reorder', 'Price', 'Location']}>
          {rows.map((row) => {
            const category = Array.isArray(row.category) ? row.category[0] : row.category;
            const low = Number(row.quantity_on_hand) <= Number(row.reorder_level);
            return (
              <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                <td className="px-3 py-2 font-mono text-xs">{row.sku}</td>
                <td className="px-3 py-2"><Link className="text-lmew-blue-800 hover:underline dark:text-sky-300" to={`/inventory/${row.id}`}>{row.name}</Link>{row.is_active ? null : <> <Badge>inactive</Badge></>}</td>
                <td className="px-3 py-2">{category?.name ?? '—'}</td>
                <td className="px-3 py-2">{row.quantity_on_hand} {low ? <Badge tone="amber">low</Badge> : null}</td>
                <td className="px-3 py-2">{row.reorder_level}</td>
                <td className="px-3 py-2">{Number(row.unit_price ?? 0).toLocaleString()}</td>
                <td className="px-3 py-2">{row.location ?? '—'}</td>
              </tr>
            );
          })}
        </Table>
      </DataState>
    </Page>
  );
};
