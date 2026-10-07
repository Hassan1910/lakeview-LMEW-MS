import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { useCustomerOptions, useVesselOptions } from '../lib/options';
import { statusLabel } from '../lib/format';
import { Badge, Button, Card, Field, Notice, Page, Table, errorMessage, inputClass, statusTone } from '../components/ui';

const STATUSES = ['scheduled', 'completed', 'cancelled'];

export const Appointments: React.FC = () => {
  const { can, profile } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ customerId: '', vesselId: '', scheduledAt: '', purpose: '', notes: '' });
  const [showPast, setShowPast] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const customers = useCustomerOptions(can('appointments.create'));
  const vessels = useVesselOptions(form.customerId);

  const query = useQuery({
    queryKey: ['appointments', showPast],
    queryFn: async () => {
      let request = db()
        .from('appointments')
        .select('id, scheduled_at, purpose, status, notes, customer:customers(company_name, profile:profiles!customers_profile_id_fkey(full_name)), vessel:vessels(name)')
        .order('scheduled_at', { ascending: !showPast });
      if (!showPast) request = request.gte('scheduled_at', new Date(Date.now() - 86_400_000).toISOString());
      const { data, error: listError } = await request.limit(200);
      if (listError) throw listError;
      return data ?? [];
    },
  });

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!form.customerId) return setError('Choose a customer.');
    if (!form.scheduledAt) return setError('Choose a date and time.');
    const { error: insertError } = await db().from('appointments').insert({
      customer_id: form.customerId,
      vessel_id: form.vesselId || null,
      scheduled_at: new Date(form.scheduledAt).toISOString(),
      purpose: form.purpose.trim() || null,
      notes: form.notes.trim() || null,
      created_by: profile?.id,
    });
    if (insertError) return setError(insertError.message);
    setSuccess('Appointment scheduled.');
    setForm({ customerId: '', vesselId: '', scheduledAt: '', purpose: '', notes: '' });
    queryClient.invalidateQueries({ queryKey: ['appointments'] });
  };

  const setStatus = async (id: string, status: string) => {
    setError(null);
    const { error: updateError } = await db().from('appointments').update({ status }).eq('id', id);
    if (updateError) setError(updateError.message);
    queryClient.invalidateQueries({ queryKey: ['appointments'] });
  };

  return (
    <Page title="Appointments" description="Customer visits, inspections, and drop-offs.">
      {can('appointments.create') ? (
        <Card title="Schedule an appointment">
          <form className="grid gap-3 md:grid-cols-3" onSubmit={create}>
            <Field label="Customer">
              <select className={inputClass} value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value, vesselId: '' })}>
                <option value="">Choose a customer…</option>
                {(customers.data ?? []).map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
              </select>
            </Field>
            <Field label="Vessel (optional)">
              <select className={inputClass} value={form.vesselId} disabled={!form.customerId} onChange={(e) => setForm({ ...form, vesselId: e.target.value })}>
                <option value="">No vessel</option>
                {(vessels.data ?? []).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
            </Field>
            <Field label="When"><input className={inputClass} type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></Field>
            <Field label="Purpose"><input className={inputClass} placeholder="Engine inspection, hull survey…" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></Field>
            <Field label="Notes"><input className={inputClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <div className="flex items-end"><Button type="submit">Schedule</Button></div>
          </form>
          <div className="mt-3 space-y-2"><Notice tone="success">{success}</Notice></div>
        </Card>
      ) : null}
      <Notice tone="error">{error}</Notice>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} /> Include past appointments</label>
      <DataState loading={query.isLoading} error={errorMessage(query.error)} empty={!query.data?.length} emptyLabel="No upcoming appointments.">
        <Table head={['When', 'Customer', 'Vessel', 'Purpose', 'Status']}>
          {(query.data ?? []).map((row) => {
            const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
            const customerProfile = customer ? (Array.isArray(customer.profile) ? customer.profile[0] : customer.profile) : null;
            const vessel = Array.isArray(row.vessel) ? row.vessel[0] : row.vessel;
            return (
              <tr key={row.id}>
                <td className="px-3 py-2 whitespace-nowrap">{new Date(row.scheduled_at).toLocaleString()}</td>
                <td className="px-3 py-2">{customer?.company_name || customerProfile?.full_name || '—'}</td>
                <td className="px-3 py-2">{vessel?.name ?? '—'}</td>
                <td className="px-3 py-2">{row.purpose ?? '—'}{row.notes ? <span className="block text-xs text-slate-500">{row.notes}</span> : null}</td>
                <td className="px-3 py-2">
                  {can('appointments.edit') ? (
                    <select aria-label="Appointment status" className={`${inputClass} w-36`} value={row.status ?? 'scheduled'} onChange={(e) => setStatus(row.id, e.target.value)}>
                      {[...new Set([row.status ?? 'scheduled', ...STATUSES])].map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                    </select>
                  ) : <Badge tone={statusTone(row.status)}>{statusLabel(row.status ?? 'scheduled')}</Badge>}
                </td>
              </tr>
            );
          })}
        </Table>
      </DataState>
    </Page>
  );
};
