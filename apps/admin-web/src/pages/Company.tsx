import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import { DataState } from '../components/DataState';

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
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (query.data) setForm({ about: query.data.about ?? '', mission: query.data.mission ?? '', vision: query.data.vision ?? '', phone: query.data.phone ?? '', email: query.data.email ?? '', address: query.data.address ?? '' });
  }, [query.data]);
  const save = async () => {
    const { error } = await db().from('company_info').update(form).eq('id', 1);
    setMessage(error?.message ?? 'Company profile saved');
  };
  return (
    <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null}>
      <div className="space-y-2">
        {(['about', 'mission', 'vision', 'phone', 'email', 'address'] as const).map((key) => (
          <textarea key={key} className="w-full rounded border p-2" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} placeholder={key} />
        ))}
        <button className="rounded bg-[#0B4F6C] px-3 py-1 text-white" onClick={save}>Save</button>
        {message ? <p>{message}</p> : null}
      </div>
    </DataState>
  );
};
