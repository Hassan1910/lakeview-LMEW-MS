import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QuotationCreateSchema, type QuotationCreateInput } from '@lmew/shared-types';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';

export const Quotations: React.FC = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['quotations'],
    queryFn: async () => {
      const { data, error: listError } = await db().from('quotations').select('id, code, status, total, currency').order('created_at', { ascending: false });
      if (listError) throw listError;
      return data ?? [];
    },
  });
  const requests = useQuery({
    queryKey: ['quote-requests'],
    queryFn: async () => {
      const { data, error: listError } = await db().from('service_requests').select('id, code, title').order('created_at', { ascending: false }).limit(100);
      if (listError) throw listError;
      return data ?? [];
    },
  });
  const catalog = useQuery({
    queryKey: ['quote-catalog'],
    queryFn: async () => {
      const { data, error: listError } = await db().from('inventory_items').select('id, name, unit_price').eq('is_active', true).order('name');
      if (listError) throw listError;
      return data ?? [];
    },
  });
  const form = useForm<QuotationCreateInput>({
    resolver: zodResolver(QuotationCreateSchema),
    defaultValues: { items: [{ description: 'Labour', quantity: 1, unit_price: 0 }] },
  });
  const items = form.watch('items');
  const submit = form.handleSubmit(async (values) => {
    const created = await db().from('quotations').insert({
      service_request_id: values.service_request_id,
      valid_until: values.valid_until,
      notes: values.notes,
      created_by: profile?.id,
      status: 'draft',
    }).select('id').single();
    if (created.error || !created.data) return setError(created.error?.message ?? 'Could not create quotation');
    const inserted = await db().from('quotation_items').insert(values.items.map((item) => ({ ...item, quotation_id: created.data.id })));
    if (inserted.error) return setError(inserted.error.message);
    await db().from('quotations').update({ status: 'sent' }).eq('id', created.data.id);
    setSuccess('Quotation sent');
    setError(null);
    queryClient.invalidateQueries({ queryKey: ['quotations'] });
  });
  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-2 rounded bg-white p-4 dark:bg-slate-900">
        <select className="w-full rounded border p-2" {...form.register('service_request_id')}>
          <option value="">Service request</option>
          {requests.data?.map((request) => <option key={request.id} value={request.id}>{request.code} · {request.title}</option>)}
        </select>
        <input className="w-full rounded border p-2" type="date" {...form.register('valid_until')} />
        {items.map((item, index) => (
          <div key={index} className="grid gap-2 md:grid-cols-4">
            <select className="rounded border p-2" onChange={(event) => {
              const part = catalog.data?.find((row) => row.id === event.target.value);
              if (!part) return;
              form.setValue(`items.${index}.description`, part.name);
              form.setValue(`items.${index}.unit_price`, Number(part.unit_price ?? 0));
              form.setValue(`items.${index}.inventory_item_id`, part.id);
            }}>
              <option value="">Inventory item</option>
              {catalog.data?.map((part) => <option key={part.id} value={part.id}>{part.name}</option>)}
            </select>
            <input className="rounded border p-2" placeholder="Description" {...form.register(`items.${index}.description`)} />
            <input className="rounded border p-2" type="number" step="0.01" {...form.register(`items.${index}.quantity`, { valueAsNumber: true })} />
            <input className="rounded border p-2" type="number" step="0.01" {...form.register(`items.${index}.unit_price`, { valueAsNumber: true })} />
          </div>
        ))}
        <button type="button" onClick={() => form.setValue('items', [...items, { description: '', quantity: 1, unit_price: 0 }])}>Add line</button>
        {error ? <p className="text-red-600">{error}</p> : null}
        {success ? <p className="text-green-600">{success}</p> : null}
        <button className="rounded bg-[#0B4F6C] px-3 py-1 text-white">Create and send</button>
      </form>
      <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!query.data?.length} emptyLabel="No quotations.">
        <ul>{query.data?.map((row) => <li key={row.id}>{row.code} · {row.status} · {row.total} {row.currency}</li>)}</ul>
      </DataState>
    </div>
  );
};
