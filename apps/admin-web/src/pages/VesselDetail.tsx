import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { statusLabel } from '../lib/format';
import { useConfirm } from '../components/confirm';
import { DataState } from '../components/DataState';
import { Button, Card, Field, Notice, Page, StatusBadge, inputClass, linkClass } from '../components/ui';

const TYPES = ['fishing_boat', 'passenger_boat', 'cargo_boat', 'tugboat', 'speedboat', 'ferry', 'other'];

export const VesselDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', registration_no: '', type: '', length_m: '', engine_details: '', year_built: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editable = can('vessels.edit');
  const query = useQuery({
    queryKey: ['vessel', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error: loadError } = await db().from('vessels').select('*, customer:customers(id, company_name), requests:service_requests(id, code, title, status)').eq('id', id).single();
      if (loadError) throw loadError;
      return data;
    },
  });

  useEffect(() => {
    const row = query.data;
    if (!row) return;
    setForm({
      name: row.name ?? '',
      registration_no: row.registration_no ?? '',
      type: row.type ?? '',
      length_m: row.length_m == null ? '' : String(row.length_m),
      engine_details: row.engine_details ?? '',
      year_built: row.year_built == null ? '' : String(row.year_built),
    });
  }, [query.data]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return setError('A vessel needs a name.');
    setSaving(true);
    setError(null);
    setSuccess(null);
    const { error: updateError } = await db().from('vessels').update({
      name: form.name.trim(),
      registration_no: form.registration_no.trim() || null,
      type: form.type || null,
      length_m: form.length_m ? Number(form.length_m) : null,
      engine_details: form.engine_details.trim() || null,
      year_built: form.year_built ? Number(form.year_built) : null,
    }).eq('id', id);
    setSaving(false);
    if (updateError) return setError(updateError.message);
    setSuccess('Vessel saved.');
    queryClient.invalidateQueries({ queryKey: ['vessel', id] });
    queryClient.invalidateQueries({ queryKey: ['vessels'] });
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete vessel',
      description: 'Vessels with service history cannot be deleted. Empty records can.',
      confirmLabel: 'Delete vessel',
      tone: 'danger',
    });
    if (!ok) return;
    setError(null);
    const { error: deleteError } = await db().from('vessels').delete().eq('id', id);
    if (deleteError) return setError(deleteError.message);
    queryClient.invalidateQueries({ queryKey: ['vessels'] });
    navigate('/vessels');
  };

  const row = query.data;
  const customer = row ? (Array.isArray(row.customer) ? row.customer[0] : row.customer) : null;

  return (
    <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!row} emptyLabel="Vessel not found.">
      {row ? (
        <Page title={row.name} description={customer?.company_name ? `Owner ${customer.company_name}` : 'No owner name on file'} actions={<Link className={`text-sm ${linkClass}`} to="/vessels">All vessels</Link>}>
          <Notice tone="error">{error}</Notice>
          <Notice tone="success">{success}</Notice>
          <Card title="Details">
            <form className="grid gap-3 md:grid-cols-2" onSubmit={save}>
              <Field label="Name" required><input className={inputClass} value={form.name} disabled={!editable} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
              <Field label="Registration"><input className={inputClass} value={form.registration_no} disabled={!editable} onChange={(event) => setForm({ ...form, registration_no: event.target.value })} /></Field>
              <Field label="Type">
                <select className={inputClass} value={form.type} disabled={!editable} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                  <option value="">Not set</option>
                  {TYPES.map((type) => <option key={type} value={type}>{statusLabel(type)}</option>)}
                </select>
              </Field>
              <Field label="Length (m)"><input className={inputClass} inputMode="decimal" value={form.length_m} disabled={!editable} onChange={(event) => setForm({ ...form, length_m: event.target.value })} /></Field>
              <Field label="Year built"><input className={inputClass} inputMode="numeric" value={form.year_built} disabled={!editable} onChange={(event) => setForm({ ...form, year_built: event.target.value })} /></Field>
              <Field label="Engine"><input className={inputClass} value={form.engine_details} disabled={!editable} onChange={(event) => setForm({ ...form, engine_details: event.target.value })} /></Field>
              <div className="flex flex-wrap gap-2 md:col-span-2">
                {editable ? <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save vessel'}</Button> : null}
                {can('vessels.delete') ? <Button variant="danger" onClick={remove}>Delete</Button> : null}
                {customer?.id ? <Link className={`self-center text-sm ${linkClass}`} to={`/customers/${customer.id}`}>Open owner</Link> : null}
              </div>
            </form>
          </Card>
          <Card title="Service requests">
            {(row.requests ?? []).length === 0 ? <p className="text-sm text-slate-500">No requests for this vessel.</p> : (
              <ul className="space-y-2 text-sm">
                {(row.requests as { id: string; code: string | null; title: string; status: string }[]).map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2">
                    <Link className={linkClass} to={`/service-requests/${item.id}`}>{item.code ?? item.title}</Link>
                    <StatusBadge status={item.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Page>
      ) : null}
    </DataState>
  );
};
