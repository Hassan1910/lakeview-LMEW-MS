import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';

export const Feedback: React.FC = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [response, setResponse] = useState<Record<string, string>>({});
  const query = useQuery({
    queryKey: ['feedback'],
    queryFn: async () => {
      const { data, error } = await db().from('feedback').select('id, rating, comment, response, category').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const reply = async (id: string) => {
    await db().from('feedback').update({ response: response[id] ?? '', responded_by: profile?.id }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['feedback'] });
  };
  return (
    <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!query.data?.length} emptyLabel="No feedback yet.">
      <ul className="space-y-3">
        {query.data?.map((row) => (
          <li key={row.id} className="rounded bg-white p-3 dark:bg-slate-900">
            <p>{row.rating}/5 · {row.category}</p>
            <p>{row.comment}</p>
            <p>Response: {row.response ?? 'None'}</p>
            <input className="rounded border p-1" value={response[row.id] ?? ''} onChange={(event) => setResponse({ ...response, [row.id]: event.target.value })} />
            <button onClick={() => reply(row.id)}>Respond</button>
          </li>
        ))}
      </ul>
    </DataState>
  );
};
