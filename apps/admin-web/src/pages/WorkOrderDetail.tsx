import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db, watch } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { statusLabel, toLocalInput } from '../lib/format';
import { DataState } from '../components/DataState';
import { Button, Card, Field, Notice, Page, StatusBadge, inputClass, linkClass } from '../components/ui';

const STATUSES = ['assigned', 'in_progress', 'blocked', 'completed', 'cancelled'];

type Person = { id: string; full_name: string | null };
type Part = { id: string; quantity: number; inventory_item: { name: string; sku: string } | { name: string; sku: string }[] | null };

export const WorkOrderDetail: React.FC = () => {
  const { id } = useParams();
  const { can, profile } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = can('work_orders.edit');
  const canAssign = can('work_orders.assign');
  const canParts = can('work_order_parts.manage');
  const [form, setForm] = useState({ status: 'assigned', notes: '', scheduled_start: '', scheduled_end: '', assigned_to: '', supervisor_id: '' });
  const [part, setPart] = useState({ itemId: '', quantity: '1' });
  const [media, setMedia] = useState<{ kind: string; storage_path: string; url?: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const query = useQuery({
    queryKey: ['work-order', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error: loadError } = await db().from('work_orders').select('*, media:work_order_media(kind, storage_path), parts:work_order_parts(id, quantity, inventory_item:inventory_items(name, sku)), service_request:service_requests(id, code, title)').eq('id', id).single();
      if (loadError) throw loadError;
      return data;
    },
  });
  const people = useQuery({
    queryKey: ['assignable-techs'],
    enabled: canAssign,
    queryFn: async () => {
      const [techs, supervisors] = await Promise.all([
        db().rpc('assignable_profiles', { p_permission: 'work_orders.execute' }),
        db().rpc('assignable_profiles', { p_permission: 'work_orders.assign' }),
      ]);
      if (techs.error) throw techs.error;
      if (supervisors.error) throw supervisors.error;
      return { technicians: (techs.data ?? []) as Person[], supervisors: (supervisors.data ?? []) as Person[] };
    },
  });
  const catalog = useQuery({
    queryKey: ['parts-catalog'],
    enabled: canParts,
    queryFn: async () => {
      const { data, error: loadError } = await db().from('inventory_items').select('id, name, sku, quantity_on_hand').eq('is_active', true).order('name');
      if (loadError) throw loadError;
      return data ?? [];
    },
  });

  useEffect(() => watch('work_orders', () => queryClient.invalidateQueries({ queryKey: ['work-order', id] }), `id=eq.${id}`), [id, queryClient]);
  useEffect(() => {
    const row = query.data;
    if (!row) return;
    setForm({
      status: row.status ?? 'assigned',
      notes: row.notes ?? '',
      scheduled_start: toLocalInput(row.scheduled_start),
      scheduled_end: toLocalInput(row.scheduled_end),
      assigned_to: row.assigned_to ?? '',
      supervisor_id: row.supervisor_id ?? '',
    });
  }, [query.data]);
  useEffect(() => {
    const rows = (query.data?.media ?? []) as { kind: string; storage_path: string }[];
    void Promise.all(rows.map(async (item) => {
      const signed = await db().storage.from('work-order-media').createSignedUrl(item.storage_path, 3600);
      return { ...item, url: signed.data?.signedUrl };
    })).then(setMedia);
  }, [query.data]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    const patch: Record<string, string | null> = {
      status: form.status,
      notes: form.notes.trim() || null,
      scheduled_start: form.scheduled_start ? new Date(form.scheduled_start).toISOString() : null,
      scheduled_end: form.scheduled_end ? new Date(form.scheduled_end).toISOString() : null,
    };
    if (canAssign) {
      if (form.assigned_to) patch.assigned_to = form.assigned_to;
      patch.supervisor_id = form.supervisor_id || null;
    }
    const { error: updateError } = await db().from('work_orders').update(patch).eq('id', id);
    setSaving(false);
    if (updateError) return setError(updateError.message);
    setSuccess('Work order saved.');
    queryClient.invalidateQueries({ queryKey: ['work-order', id] });
    queryClient.invalidateQueries({ queryKey: ['work-orders'] });
  };

  const issuePart = async (event: React.FormEvent) => {
    event.preventDefault();
    const quantity = Number(part.quantity);
    if (!part.itemId) return setError('Choose a part.');
    if (!Number.isFinite(quantity) || quantity <= 0) return setError('Quantity must be greater than zero.');
    setSaving(true);
    setError(null);
    setSuccess(null);
    const { error: insertError } = await db().from('work_order_parts').insert({
      work_order_id: id,
      inventory_item_id: part.itemId,
      quantity,
      requested_by: profile?.id,
    });
    setSaving(false);
    if (insertError) return setError(insertError.message);
    setPart({ itemId: '', quantity: '1' });
    setSuccess('Part issued and stock reduced.');
    queryClient.invalidateQueries({ queryKey: ['work-order', id] });
    queryClient.invalidateQueries({ queryKey: ['parts-catalog'] });
  };

  const row = query.data;
  const request = row ? (Array.isArray(row.service_request) ? row.service_request[0] : row.service_request) : null;
  const parts = (row?.parts ?? []) as Part[];

  return (
    <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!row} emptyLabel="Work order not found.">
      {row ? (
        <Page title={row.code ?? 'Work order'} description={request ? `${request.code ?? ''} ${request.title ?? ''}`.trim() : 'Job notes, schedule, and parts.'} actions={<Link className={`text-sm ${linkClass}`} to="/work-orders">All jobs</Link>}>
          <Notice tone="error">{error}</Notice>
          <Notice tone="success">{success}</Notice>
          <Card title="Job">
            <form className="grid gap-3 md:grid-cols-2" onSubmit={save}>
              <Field label="Status">
                <select className={inputClass} value={form.status} disabled={!canEdit} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  {STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                </select>
              </Field>
              <div className="flex items-end"><StatusBadge status={row.status} /></div>
              <Field label="Technician">
                <select className={inputClass} value={form.assigned_to} disabled={!canAssign} onChange={(event) => setForm({ ...form, assigned_to: event.target.value })}>
                  <option value="">Unassigned</option>
                  {(people.data?.technicians ?? []).map((person) => <option key={person.id} value={person.id}>{person.full_name ?? 'Technician'}</option>)}
                </select>
              </Field>
              <Field label="Supervisor">
                <select className={inputClass} value={form.supervisor_id} disabled={!canAssign} onChange={(event) => setForm({ ...form, supervisor_id: event.target.value })}>
                  <option value="">Unassigned</option>
                  {(people.data?.supervisors ?? []).map((person) => <option key={person.id} value={person.id}>{person.full_name ?? 'Supervisor'}</option>)}
                </select>
              </Field>
              <Field label="Starts"><input className={inputClass} type="datetime-local" value={form.scheduled_start} disabled={!canEdit} onChange={(event) => setForm({ ...form, scheduled_start: event.target.value })} /></Field>
              <Field label="Ends"><input className={inputClass} type="datetime-local" value={form.scheduled_end} disabled={!canEdit} onChange={(event) => setForm({ ...form, scheduled_end: event.target.value })} /></Field>
              <div className="md:col-span-2">
                <Field label="Notes"><textarea className={inputClass} rows={3} value={form.notes} disabled={!canEdit} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
              </div>
              {canEdit ? <div><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save job'}</Button></div> : null}
            </form>
            {request?.id ? <p className="mt-3 text-sm"><Link className={linkClass} to={`/service-requests/${request.id}`}>Open service request</Link></p> : null}
          </Card>
          <Card title="Parts">
            {parts.length === 0 ? <p className="text-sm text-slate-500">No parts issued.</p> : (
              <ul className="mb-3 space-y-1 text-sm">
                {parts.map((item) => {
                  const stock = Array.isArray(item.inventory_item) ? item.inventory_item[0] : item.inventory_item;
                  return <li key={item.id}>{item.quantity} · {stock?.name ?? 'Part'}{stock?.sku ? ` (${stock.sku})` : ''}</li>;
                })}
              </ul>
            )}
            {canParts ? (
              <form className="grid gap-3 md:grid-cols-3" onSubmit={issuePart}>
                <Field label="Part">
                  <select className={inputClass} value={part.itemId} onChange={(event) => setPart({ ...part, itemId: event.target.value })}>
                    <option value="">Choose a part…</option>
                    {(catalog.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.sku}) · {item.quantity_on_hand} on hand</option>)}
                  </select>
                </Field>
                <Field label="Quantity"><input className={inputClass} inputMode="decimal" value={part.quantity} onChange={(event) => setPart({ ...part, quantity: event.target.value })} /></Field>
                <div className="flex items-end"><Button type="submit" disabled={saving}>Issue part</Button></div>
              </form>
            ) : null}
          </Card>
          <Card title="Media">
            {media.length === 0 ? <p className="text-sm text-slate-500">No media.</p> : (
              <ul className="space-y-1 text-sm">
                {media.map((item) => <li key={item.storage_path}>{item.url ? <a className={linkClass} href={item.url} target="_blank" rel="noreferrer">{statusLabel(item.kind)}</a> : statusLabel(item.kind)}</li>)}
              </ul>
            )}
          </Card>
        </Page>
      ) : null}
    </DataState>
  );
};
