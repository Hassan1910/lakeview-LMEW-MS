import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db, watch } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';

export const Notifications: React.FC = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin-notes', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await db().from('notifications').select('id, title, body, read_at').eq('user_id', profile!.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => {
    if (!profile) return;
    return watch('notifications', () => queryClient.invalidateQueries({ queryKey: ['admin-notes', profile.id] }), `user_id=eq.${profile.id}`);
  }, [profile, queryClient]);
  const mark = async (id: string) => {
    await db().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['admin-notes'] });
  };
  return (
    <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!query.data?.length} emptyLabel="No notifications.">
      <ul>{query.data?.map((row) => <li key={row.id}><button onClick={() => mark(row.id)}>{row.title}</button> · {row.body} · {row.read_at ? 'read' : 'new'}</li>)}</ul>
    </DataState>
  );
};
