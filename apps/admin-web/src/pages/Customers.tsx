import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import { DataState } from '../components/DataState';

export const Customers: React.FC = () => {
  const query = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await db().from('customers').select('id, company_name, kra_pin, profile:profiles!profile_id(full_name, phone)').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!query.data?.length} emptyLabel="No customers.">
      <ul>{query.data?.map((row) => {
        const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
        return <li key={row.id}>{row.company_name ?? profile?.full_name} · {row.kra_pin}</li>;
      })}</ul>
    </DataState>
  );
};
