import React, { useState } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { Button, Card, Field, Notice, Page, Table, errorMessage, inputClass } from '../components/ui';

const blank = { company_name: '', kra_pin: '', notes: '' };

export const Reception: React.FC = () => {
  const { can, profile } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['walkins'],
    queryFn: async () => {
      const { data, error: listError } = await db().from('customers').select('id, company_name, kra_pin, notes, created_at').is('profile_id', null).order('created_at', { ascending: false }).limit(50);
      if (listError) throw listError;
      return data ?? [];
    },
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (form.company_name.trim().length < 2) return setError('Enter the customer or company name.');
    const { error: insertError } = await db().from('customers').insert({
      company_name: form.company_name.trim(),
      kra_pin: form.kra_pin.trim() || null,
      notes: form.notes.trim() || null,
      created_by: profile?.id,
    });
    if (insertError) return setError(insertError.message);
    setSuccess(`${form.company_name.trim()} saved.`);
    setForm(blank);
    queryClient.invalidateQueries({ queryKey: ['walkins'] });
    queryClient.invalidateQueries({ queryKey: ['customer-options'] });
    queryClient.invalidateQueries({ queryKey: ['customers'] });
  };

  return (
    <Page title="Walk-in customer" description="Register customers who arrive without a portal account.">
      <Card>
        <form className="grid max-w-2xl gap-3 md:grid-cols-2" onSubmit={submit}>
          <Field label="Customer or company name"><input className={inputClass} value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></Field>
          <Field label="KRA PIN"><input className={inputClass} value={form.kra_pin} onChange={(e) => setForm({ ...form, kra_pin: e.target.value })} /></Field>
          <div className="md:col-span-2"><Field label="Notes" hint="Phone, contact person, how they found us"><textarea className={inputClass} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button type="submit">Save walk-in</Button>
            {can('service_requests.create') ? <Link className="rounded-sm border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700" to="/requests/new">Open a service request</Link> : null}
          </div>
        </form>
        <div className="mt-3 space-y-2"><Notice tone="error">{error}</Notice><Notice tone="success">{success}</Notice></div>
      </Card>
      <h2 className="font-semibold">Recent walk-ins</h2>
      <DataState loading={query.isLoading} error={errorMessage(query.error)} empty={!query.data?.length} emptyLabel="No walk-in records yet.">
        <Table head={['Name', 'KRA PIN', 'Notes', 'Registered']}>
          {(query.data ?? []).map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-2 font-medium">{row.company_name}</td>
              <td className="px-3 py-2">{row.kra_pin ?? '—'}</td>
              <td className="px-3 py-2">{row.notes ?? '—'}</td>
              <td className="px-3 py-2">{new Date(row.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </Table>
      </DataState>
    </Page>
  );
};
