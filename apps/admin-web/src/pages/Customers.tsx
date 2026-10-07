import React, { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import { DataState } from '../components/DataState';
import { useClientPage } from '../components/useClientPage';
import { Page, Pagination, SearchField, Table, linkClass, tdClass } from '../components/ui';

export const Customers: React.FC = () => {
  const [term, setTerm] = useState('');
  const query = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await db().from('customers').select('id, company_name, kra_pin, profile:profiles!profile_id(full_name, phone)').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = useMemo(() => (query.data ?? []).filter((row) => {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    const haystack = `${row.company_name ?? ''} ${profile?.full_name ?? ''} ${row.kra_pin ?? ''} ${profile?.phone ?? ''}`.toLowerCase();
    return haystack.includes(term.trim().toLowerCase());
  }), [query.data, term]);
  const page = useClientPage(rows);

  return (
    <Page title="Customers" description="Companies and account holders on record.">
      <SearchField value={term} onChange={(value) => { setTerm(value); page.setPage(1); }} placeholder="Search name, phone, or KRA PIN" />
      <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!rows.length} emptyLabel={term ? 'No customers match that search.' : 'No customers yet.'}>
        <Table head={['Customer', 'KRA PIN', { content: 'Phone', className: 'hidden md:table-cell' }]}>
          {page.slice.map((row) => {
            const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
            return (
              <tr key={row.id}>
                <td className={`${tdClass} font-medium`}><Link className={linkClass} to={`/customers/${row.id}`}>{row.company_name ?? profile?.full_name ?? 'Unnamed customer'}</Link></td>
                <td className={tdClass}>{row.kra_pin || '—'}</td>
                <td className={`${tdClass} hidden md:table-cell`}>{profile?.phone || '—'}</td>
              </tr>
            );
          })}
        </Table>
        <Pagination page={page.page} pageCount={page.pageCount} total={page.total} onPage={page.setPage} />
      </DataState>
    </Page>
  );
};
