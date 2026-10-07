import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QuotationCreateSchema, type QuotationCreateInput } from '@lmew/shared-types';
import { db } from '../lib/supabase';
import { formatMoney } from '../lib/format';
import { DataState } from '../components/DataState';
import { useClientPage } from '../components/useClientPage';
import { Button, Card, Field, Notice, Page, Pagination, SearchField, StatusBadge, Table, inputClass, tdClass } from '../components/ui';

export const Quotations: React.FC = () => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [term, setTerm] = useState('');
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
    setError(null);
    setSuccess(null);
    const saved = await db().rpc('save_request_quotation', {
      p_service_request_id: values.service_request_id,
      p_valid_until: values.valid_until,
      p_notes: values.notes ?? null,
      p_items: values.items,
      p_send: true,
      p_replace_header: true,
    });
    const updated = Boolean(saved.data && typeof saved.data === 'object' && 'updated' in saved.data && saved.data.updated);
    if (saved.error || !saved.data) return setError(saved.error?.message ?? 'Could not save quotation');
    setSuccess(updated ? 'Draft quotation updated and sent.' : 'Quotation sent.');
    queryClient.invalidateQueries({ queryKey: ['quotations'] });
  });
  const rows = (query.data ?? []).filter((row) => `${row.code ?? ''} ${row.status ?? ''}`.toLowerCase().includes(term.trim().toLowerCase()));
  const page = useClientPage(rows);

  return (
    <Page title="Quotations" description="Prepare a quote and send it to the customer.">
      <Card title="New quotation">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Service request" required>
              <select className={inputClass} {...form.register('service_request_id')}>
                <option value="">Choose a request…</option>
                {requests.data?.map((request) => <option key={request.id} value={request.id}>{request.code} · {request.title}</option>)}
              </select>
            </Field>
            <Field label="Valid until">
              <input className={inputClass} type="date" {...form.register('valid_until')} />
            </Field>
          </div>
          {items.map((item, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-4">
              <select aria-label="Inventory item" className={inputClass} onChange={(event) => {
                const part = catalog.data?.find((row) => row.id === event.target.value);
                if (!part) return;
                form.setValue(`items.${index}.description`, part.name);
                form.setValue(`items.${index}.unit_price`, Number(part.unit_price ?? 0));
                form.setValue(`items.${index}.inventory_item_id`, part.id);
              }}>
                <option value="">Inventory item</option>
                {catalog.data?.map((part) => <option key={part.id} value={part.id}>{part.name}</option>)}
              </select>
              <input aria-label="Description" className={inputClass} placeholder="Description" {...form.register(`items.${index}.description`)} />
              <input aria-label="Quantity" className={inputClass} type="number" step="0.01" {...form.register(`items.${index}.quantity`, { valueAsNumber: true })} />
              <input aria-label="Unit price" className={inputClass} type="number" step="0.01" {...form.register(`items.${index}.unit_price`, { valueAsNumber: true })} />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => form.setValue('items', [...items, { description: '', quantity: 1, unit_price: 0 }])}>Add line</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Sending…' : 'Create and send'}</Button>
          </div>
          <Notice tone="error">{error ?? form.formState.errors.service_request_id?.message}</Notice>
          <Notice tone="success">{success}</Notice>
        </form>
      </Card>
      <SearchField value={term} onChange={(value) => { setTerm(value); page.setPage(1); }} placeholder="Search quotation code" />
      <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!rows.length} emptyLabel={term ? 'No quotations match that search.' : 'No quotations yet.'}>
        <Table head={['Code', 'Status', 'Total']}>
          {page.slice.map((row) => (
            <tr key={row.id}>
              <td className={`${tdClass} font-medium`}>{row.code}</td>
              <td className={tdClass}><StatusBadge status={row.status} /></td>
              <td className={tdClass}>{formatMoney(row.total, row.currency ?? 'KES')}</td>
            </tr>
          ))}
        </Table>
        <Pagination page={page.page} pageCount={page.pageCount} total={page.total} onPage={page.setPage} />
      </DataState>
    </Page>
  );
};
