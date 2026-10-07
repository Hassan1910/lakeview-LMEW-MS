import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import { DataState } from '../components/DataState';
import { Button, Card, Field, Notice, Page, inputClass } from '../components/ui';

const FIELDS = [
  ['about', 'About', true],
  ['mission', 'Mission', true],
  ['vision', 'Vision', true],
  ['phone', 'Phone', false],
  ['email', 'Email', false],
  ['address', 'Address', false],
] as const;

export const Company: React.FC = () => {
  const query = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const { data, error } = await db().from('company_info').select('*').eq('id', 1).single();
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState({ about: '', mission: '', vision: '', phone: '', email: '', address: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (query.data) setForm({ about: query.data.about ?? '', mission: query.data.mission ?? '', vision: query.data.vision ?? '', phone: query.data.phone ?? '', email: query.data.email ?? '', address: query.data.address ?? '' });
  }, [query.data]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    const { error: updateError } = await db().from('company_info').update(form).eq('id', 1);
    setSaving(false);
    if (updateError) setError(updateError.message);
    else setSuccess('Company profile saved.');
  };
  return (
    <Page title="Company" description="Public profile text used across the customer apps.">
      <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null}>
        <Card>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={save}>
            {FIELDS.map(([key, label, wide]) => (
              <div key={key} className={wide ? 'md:col-span-2' : ''}>
                <Field label={label}>
                  {wide ? (
                    <textarea className={inputClass} rows={4} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
                  ) : (
                    <input className={inputClass} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
                  )}
                </Field>
              </div>
            ))}
            <div><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save company profile'}</Button></div>
          </form>
          <div className="mt-3 space-y-2">
            <Notice tone="error">{error}</Notice>
            <Notice tone="success">{success}</Notice>
          </div>
        </Card>
      </DataState>
    </Page>
  );
};
