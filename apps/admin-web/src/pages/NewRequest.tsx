import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { useCustomerOptions, useVesselOptions } from '../lib/options';
import { Button, Card, Field, Notice, Page, inputClass } from '../components/ui';

const CATEGORIES = ['boat_repair', 'ship_repair', 'engine_maintenance', 'fabrication', 'electrical', 'welding', 'equipment_supply', 'consultation', 'other'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const blank = { customerId: '', vesselId: '', title: '', description: '', location: '', category: 'engine_maintenance', priority: 'medium', preferredDate: '' };

export const NewRequest: React.FC = () => {
  const { profile, can } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; title: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const customers = useCustomerOptions();
  const vessels = useVesselOptions(form.customerId);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setCreated(null);
    if (!form.customerId) return setError('Choose a customer.');
    if (form.title.trim().length < 3) return setError('Give the request a short title.');
    if (form.description.trim().length < 5) return setError('Describe the work needed.');
    setSaving(true);
    const { data, error: insertError } = await db().from('service_requests').insert({
      customer_id: form.customerId,
      vessel_id: form.vesselId || null,
      title: form.title.trim(),
      description: form.description.trim(),
      location_text: form.location.trim() || null,
      category: form.category,
      priority: form.priority,
      preferred_date: form.preferredDate || null,
      created_by: profile?.id ?? null,
    }).select('id, title').single();
    setSaving(false);
    if (insertError) return setError(insertError.message);
    setCreated(data);
    setForm(blank);
    queryClient.invalidateQueries({ queryKey: ['service-requests'] });
  };

  return (
    <Page title="New service request" description="Log work on behalf of a customer at the desk or over the phone.">
      <Card>
        <form className="grid max-w-3xl gap-3 md:grid-cols-2" onSubmit={submit}>
          <Field label="Customer" hint={can('customers.create') ? 'New walk-in? Register them first under Walk-in customer.' : undefined}>
            <select className={inputClass} value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value, vesselId: '' })}>
              <option value="">Choose a customer…</option>
              {(customers.data ?? []).map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
            </select>
          </Field>
          <Field label="Vessel (optional)">
            <select className={inputClass} value={form.vesselId} disabled={!form.customerId} onChange={(e) => setForm({ ...form, vesselId: e.target.value })}>
              <option value="">{form.customerId && !vessels.data?.length ? 'Customer has no vessels' : 'No vessel'}</option>
              {(vessels.data ?? []).map((row) => <option key={row.id} value={row.id}>{row.name}{row.registration_no ? ` (${row.registration_no})` : ''}</option>)}
            </select>
          </Field>
          <div className="md:col-span-2"><Field label="Title"><input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field></div>
          <div className="md:col-span-2"><Field label="Description"><textarea className={inputClass} rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div>
          <Field label="Category">
            <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((value) => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select className={inputClass} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {PRIORITIES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </Field>
          <Field label="Location"><input className={inputClass} placeholder="Kisumu pier, Dunga beach…" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
          <Field label="Preferred date"><input className={inputClass} type="date" value={form.preferredDate} onChange={(e) => setForm({ ...form, preferredDate: e.target.value })} /></Field>
          <div className="md:col-span-2"><Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create request'}</Button></div>
        </form>
        <div className="mt-3 space-y-2">
          <Notice tone="error">{error}</Notice>
          {created ? (
            <Notice tone="success">
              Request “{created.title}” created.{' '}
              {can('service_requests.view') ? <Link className="underline" to={`/service-requests/${created.id}`}>Open it</Link> : null}
            </Notice>
          ) : null}
        </div>
      </Card>
    </Page>
  );
};
