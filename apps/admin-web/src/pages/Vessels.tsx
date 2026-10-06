import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import { DataState } from '../components/DataState';

export const Vessels: React.FC = () => {
  const query = useQuery({
    queryKey: ['vessels'],
    queryFn: async () => {
      const { data, error } = await db().from('vessels').select('id, name, registration_no, type, customer:customers(company_name)');
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!query.data?.length} emptyLabel="No vessels.">
      <ul>{query.data?.map((row) => {
        const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
        return <li key={row.id}>{row.name} · {row.registration_no} · {row.type} · {customer?.company_name}</li>;
      })}</ul>
    </DataState>
  );
};
