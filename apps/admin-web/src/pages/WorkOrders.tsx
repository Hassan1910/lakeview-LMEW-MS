import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db, watch } from '../lib/supabase';
import { DataState } from '../components/DataState';

export const WorkOrders: React.FC = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['work-orders'],
    queryFn: async () => {
      const { data, error } = await db().from('work_orders').select('id, code, status, scheduled_start').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => watch('work_orders', () => queryClient.invalidateQueries({ queryKey: ['work-orders'] })), [queryClient]);
  return (
    <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!query.data?.length} emptyLabel="No work orders.">
      <ul>{query.data?.map((row) => <li key={row.id}><Link to={`/work-orders/${row.id}`}>{row.code}</Link> · {row.status}</li>)}</ul>
    </DataState>
  );
};
