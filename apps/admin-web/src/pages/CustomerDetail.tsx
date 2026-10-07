import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { formatMoney, statusLabel } from '../lib/format';
import { DataState } from '../components/DataState';
import { Button, Card, Field, Notice, Page, StatusBadge, inputClass, linkClass } from '../components/ui';

type Profile = { full_name: string | null; phone: string | null; email: string | null };

export const CustomerDetail: React.FC = () => {
  const { id } = useParams();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ company_name: '', kra_pin: '', notes: '', phone: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editable = can('customers.edit');
  const canPhone = can('users.manage');
  const query = useQuery({
    queryKey: ['customer', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error: loadError } = await db().from('customers').select('id, company_name, kra_pin, notes, profile_id, profile:profiles!profile_id(full_name, phone, email), vessels(id, name, registration_no), requests:service_requests(id, code, title, status), invoices(id, code, status, balance, currency)').eq('id', id).single();
      if (loadError) throw loadError;
      return data;
    },
  });

  useEffect(() => {
    const row = query.data;
    if (!row) return;
    const profile = (Array.isArray(row.profile) ? row.profile[0] : row.profile) as Profile | null;
    setForm({
      company_name: row.company_name ?? '',
      kra_pin: row.kra_pin ?? '',
      notes: row.notes ?? '',
      phone: profile?.phone ?? '',
    });
  }, [query.data]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.data) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const { error: updateError } = await db().from('customers').update({
      company_name: form.company_name.trim() || null,
      kra_pin: form.kra_pin.trim() || null,
      notes: form.notes.trim() || null,
    }).eq('id', query.data.id);
    if (updateError) {
      setSaving(false);
      return setError(updateError.message);
    }
    const profile = (Array.isArray(query.data.profile) ? query.data.profile[0] : query.data.profile) as Profile | null;
    if (canPhone && query.data.profile_id && profile && form.phone !== (profile.phone ?? '')) {
      const { error: phoneError } = await db().from('profiles').update({ phone: form.phone.trim() || null }).eq('id', query.data.profile_id);
      if (phoneError) {
        setSaving(false);
        return setError(phoneError.message);
      }
    }
    setSaving(false);
    setSuccess('Customer saved.');
    queryClient.invalidateQueries({ queryKey: ['customer', id] });
    queryClient.invalidateQueries({ queryKey: ['customers'] });
  };

  const row = query.data;
  const profile = (row ? (Array.isArray(row.profile) ? row.profile[0] : row.profile) : null) as Profile | null;
  const name = row?.company_name || profile?.full_name || 'Customer';

  return (
    <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!row} emptyLabel="Customer not found.">
      {row ? (
        <Page title={name} description={profile?.email || 'Walk-in customer'} actions={<Link className={`text-sm ${linkClass}`} to="/customers">All customers</Link>}>
          <Notice tone="error">{error}</Notice>
          <Notice tone="success">{success}</Notice>
          <Card title="Record">
            <form className="grid gap-3 md:grid-cols-2" onSubmit={save}>
              <Field label="Company or name"><input className={inputClass} value={form.company_name} disabled={!editable} onChange={(event) => setForm({ ...form, company_name: event.target.value })} /></Field>
              <Field label="KRA PIN"><input className={inputClass} value={form.kra_pin} disabled={!editable} onChange={(event) => setForm({ ...form, kra_pin: event.target.value })} /></Field>
              <Field label="Phone" hint={canPhone ? undefined : 'Phone lives on the user account and can be changed from Users.'}>
                <input className={inputClass} value={form.phone} disabled={!canPhone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </Field>
              <Field label="Notes"><textarea className={inputClass} rows={3} value={form.notes} disabled={!editable} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
              {editable ? <div className="md:col-span-2"><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save customer'}</Button></div> : null}
            </form>
          </Card>
          <div className="grid gap-3 lg:grid-cols-3">
            <Card title="Vessels">
              <RelatedList empty="No vessels." rows={(row.vessels ?? []) as { id: string; name: string; registration_no: string | null }[]} render={(item) => (
                <Link className={linkClass} to={`/vessels/${item.id}`}>{item.name}</Link>
              )} />
            </Card>
            <Card title="Requests">
              <RelatedList empty="No requests." rows={(row.requests ?? []) as { id: string; code: string | null; title: string; status: string }[]} render={(item) => (
                <span className="flex items-center justify-between gap-2"><Link className={linkClass} to={`/service-requests/${item.id}`}>{item.code ?? item.title}</Link><StatusBadge status={item.status} /></span>
              )} />
            </Card>
            <Card title="Invoices">
              <RelatedList empty="No invoices." rows={(row.invoices ?? []) as { id: string; code: string | null; status: string; balance: number; currency: string | null }[]} render={(item) => (
                <span className="flex items-center justify-between gap-2"><Link className={linkClass} to={`/invoices/${item.id}`}>{item.code ?? 'Invoice'}</Link><span className="text-xs text-slate-500">{statusLabel(item.status)} · {formatMoney(item.balance, item.currency ?? 'KES')}</span></span>
              )} />
            </Card>
          </div>
        </Page>
      ) : null}
    </DataState>
  );
};

function RelatedList<T extends { id: string }>({ rows, empty, render }: { rows: T[]; empty: string; render: (row: T) => React.ReactNode }) {
  if (!rows.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return <ul className="space-y-2 text-sm">{rows.map((row) => <li key={row.id}>{render(row)}</li>)}</ul>;
}
