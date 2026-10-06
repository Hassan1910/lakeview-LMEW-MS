import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { Badge, Button, Card, Field, Notice, Page, Table, errorMessage, inputClass } from '../components/ui';

const blank = { name: '', contact_person: '', phone: '', email: '', category: '', payment_terms: '', is_active: true };

export const Suppliers: React.FC = () => {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error: listError } = await db().from('suppliers').select('id, name, contact_person, phone, email, category, payment_terms, rating, is_active, profile_id').order('name');
      if (listError) throw listError;
      return data ?? [];
    },
  });

  const reset = () => { setEditing(null); setForm(blank); };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (form.name.trim().length < 2) return setError('Enter the supplier name.');
    const payload = {
      name: form.name.trim(),
      contact_person: form.contact_person.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      category: form.category.trim() || null,
      payment_terms: form.payment_terms.trim() || null,
      is_active: form.is_active,
    };
    const result = editing
      ? await db().from('suppliers').update(payload).eq('id', editing)
      : await db().from('suppliers').insert(payload);
    if (result.error) return setError(result.error.message);
    setSuccess(editing ? 'Supplier updated.' : 'Supplier added.');
    reset();
    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
  };

  const showForm = editing ? can('suppliers.edit') : can('suppliers.create');

  return (
    <Page title="Suppliers" description="Vendors you buy parts and services from.">
      {showForm ? (
        <Card title={editing ? 'Edit supplier' : 'Add supplier'}>
          <form className="grid gap-3 md:grid-cols-3" onSubmit={save}>
            <Field label="Name"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Contact person"><input className={inputClass} value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></Field>
            <Field label="Category"><input className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
            <Field label="Phone"><input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Email"><input className={inputClass} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Payment terms"><input className={inputClass} placeholder="e.g. Net 30" value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
            <div className="flex gap-2 md:col-span-2 md:justify-end">
              {editing ? <Button type="button" variant="secondary" onClick={reset}>Cancel</Button> : null}
              <Button type="submit">{editing ? 'Save supplier' : 'Add supplier'}</Button>
            </div>
          </form>
          <div className="mt-3 space-y-2"><Notice tone="error">{error}</Notice><Notice tone="success">{success}</Notice></div>
        </Card>
      ) : <Notice tone="success">{success}</Notice>}
      <DataState loading={query.isLoading} error={errorMessage(query.error)} empty={!query.data?.length} emptyLabel="No suppliers yet.">
        <Table head={['Name', 'Contact', 'Phone', 'Email', 'Terms', 'Status', '']}>
          {(query.data ?? []).map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-2 font-medium">{row.name}{row.category ? <span className="block text-xs text-slate-500">{row.category}</span> : null}</td>
              <td className="px-3 py-2">{row.contact_person ?? '—'}</td>
              <td className="px-3 py-2">{row.phone ?? '—'}</td>
              <td className="px-3 py-2">{row.email ?? '—'}</td>
              <td className="px-3 py-2">{row.payment_terms ?? '—'}</td>
              <td className="px-3 py-2"><Badge tone={row.is_active ? 'green' : 'slate'}>{row.is_active ? 'active' : 'inactive'}</Badge> {row.profile_id ? <Badge tone="blue">portal</Badge> : null}</td>
              <td className="px-3 py-2 text-right">
                {can('suppliers.edit') ? (
                  <Button variant="secondary" onClick={() => {
                    setEditing(row.id);
                    setSuccess(null);
                    setForm({
                      name: row.name,
                      contact_person: row.contact_person ?? '',
                      phone: row.phone ?? '',
                      email: row.email ?? '',
                      category: row.category ?? '',
                      payment_terms: row.payment_terms ?? '',
                      is_active: row.is_active ?? true,
                    });
                  }}>Edit</Button>
                ) : null}
              </td>
            </tr>
          ))}
        </Table>
      </DataState>
    </Page>
  );
};
