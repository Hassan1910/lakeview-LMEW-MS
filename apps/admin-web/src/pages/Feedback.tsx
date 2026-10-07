import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { statusLabel } from '../lib/format';
import { DataState } from '../components/DataState';
import { useClientPage } from '../components/useClientPage';
import { Button, Notice, Page, Pagination, SearchField, inputClass } from '../components/ui';

export const Feedback: React.FC = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [response, setResponse] = useState<Record<string, string>>({});
  const [term, setTerm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['feedback'],
    queryFn: async () => {
      const { data, error: listError } = await db().from('feedback').select('id, rating, comment, response, category').order('created_at', { ascending: false });
      if (listError) throw listError;
      return data ?? [];
    },
  });
  const reply = async (id: string) => {
    const text = (response[id] ?? '').trim();
    if (!text) return setError('Write a response before saving.');
    setBusy(id);
    setError(null);
    const { error: updateError } = await db().from('feedback').update({ response: text, responded_by: profile?.id }).eq('id', id);
    setBusy(null);
    if (updateError) return setError(updateError.message);
    setMessage('Response saved.');
    queryClient.invalidateQueries({ queryKey: ['feedback'] });
  };
  const rows = (query.data ?? []).filter((row) => `${row.comment ?? ''} ${row.category ?? ''} ${row.response ?? ''}`.toLowerCase().includes(term.trim().toLowerCase()));
  const page = useClientPage(rows);

  return (
    <Page title="Feedback" description="Customer ratings and replies.">
      <SearchField value={term} onChange={(value) => { setTerm(value); page.setPage(1); }} placeholder="Search comments" />
      <Notice tone="error">{error}</Notice>
      <Notice tone="success">{message}</Notice>
      <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!rows.length} emptyLabel={term ? 'No feedback matches that search.' : 'No feedback yet.'}>
        <ul className="space-y-3">
          {page.slice.map((row) => (
            <li key={row.id} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm font-medium">{row.rating}/5 · {statusLabel(row.category)}</p>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{row.comment}</p>
              <p className="mt-2 text-sm text-slate-500">Response: {row.response || 'None yet'}</p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="min-w-[16rem] flex-1 text-sm">
                  <span className="mb-1 block font-medium">Reply</span>
                  <input className={inputClass} value={response[row.id] ?? ''} onChange={(event) => setResponse({ ...response, [row.id]: event.target.value })} />
                </label>
                <Button disabled={busy === row.id} onClick={() => reply(row.id)}>{busy === row.id ? 'Saving…' : 'Save response'}</Button>
              </div>
            </li>
          ))}
        </ul>
        <Pagination page={page.page} pageCount={page.pageCount} total={page.total} onPage={page.setPage} />
      </DataState>
    </Page>
  );
};
