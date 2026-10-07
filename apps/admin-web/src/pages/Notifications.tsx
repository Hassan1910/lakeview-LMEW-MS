import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db, watch } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { useClientPage } from '../components/useClientPage';
import { Badge, Button, Notice, Page, Pagination, SearchField } from '../components/ui';

export const Notifications: React.FC = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [term, setTerm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [markError, setMarkError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['admin-notes', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await db().from('notifications').select('id, title, body, read_at, created_at').eq('user_id', profile!.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => {
    if (!profile) return;
    return watch('notifications', () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notes', profile.id] });
      queryClient.invalidateQueries({ queryKey: ['unread-notifications', profile.id] });
    }, `user_id=eq.${profile.id}`);
  }, [profile, queryClient]);
  const mark = async (id: string) => {
    const { error } = await db().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    setMarkError(error?.message ?? null);
    setMessage(error ? null : 'Marked as read.');
    queryClient.invalidateQueries({ queryKey: ['admin-notes'] });
    queryClient.invalidateQueries({ queryKey: ['unread-notifications'] });
  };
  const rows = (query.data ?? []).filter((row) => `${row.title} ${row.body ?? ''}`.toLowerCase().includes(term.trim().toLowerCase()));
  const page = useClientPage(rows);

  return (
    <Page title="Notifications" description="Updates sent to your account.">
      <SearchField value={term} onChange={(value) => { setTerm(value); page.setPage(1); }} placeholder="Search notifications" />
      <Notice tone="error">{markError}</Notice>
      <Notice tone="success">{message}</Notice>
      <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!rows.length} emptyLabel={term ? 'No notifications match that search.' : 'No notifications yet.'}>
        <ul className="space-y-2">
          {page.slice.map((row) => (
            <li key={row.id} className={`rounded-lg border bg-white p-3 dark:bg-slate-900 ${row.read_at ? 'border-slate-200 dark:border-slate-800' : 'border-lmew-blue-800/30'}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{row.title}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{row.body}</p>
                </div>
                {row.read_at ? <Badge>Read</Badge> : <Button variant="secondary" onClick={() => mark(row.id)}>Mark read</Button>}
              </div>
            </li>
          ))}
        </ul>
        <Pagination page={page.page} pageCount={page.pageCount} total={page.total} onPage={page.setPage} />
      </DataState>
    </Page>
  );
};
