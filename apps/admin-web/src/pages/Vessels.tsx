import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import { statusLabel } from '../lib/format';
import { DataState } from '../components/DataState';
import { useClientPage } from '../components/useClientPage';
import { Page, Pagination, SearchField, Table, linkClass, tdClass } from '../components/ui';

export const Vessels: React.FC = () => {
  const [term, setTerm] = useState('');
  const query = useQuery({
    queryKey: ['vessels'],
    queryFn: async () => {
      const { data, error } = await db().from('vessels').select('id, name, registration_no, type, customer:customers(company_name)').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = useMemo(() => (query.data ?? []).filter((row) => {
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    return `${row.name} ${row.registration_no ?? ''} ${row.type ?? ''} ${customer?.company_name ?? ''}`.toLowerCase().includes(term.trim().toLowerCase());
  }), [query.data, term]);
  const page = useClientPage(rows);

  return (
    <Page title="Vessels" description="Boats and ships linked to customers.">
      <SearchField value={term} onChange={(value) => { setTerm(value); page.setPage(1); }} placeholder="Search name, registration, or owner" />
      <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!rows.length} emptyLabel={term ? 'No vessels match that search.' : 'No vessels yet.'}>
        <Table head={['Vessel', { content: 'Registration', className: 'hidden sm:table-cell' }, 'Type', { content: 'Customer', className: 'hidden md:table-cell' }]}>
          {page.slice.map((row) => {
            const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
            return (
              <tr key={row.id}>
                <td className={`${tdClass} font-medium`}><Link className={linkClass} to={`/vessels/${row.id}`}>{row.name}</Link></td>
                <td className={`${tdClass} hidden sm:table-cell`}>{row.registration_no || '—'}</td>
                <td className={tdClass}>{statusLabel(row.type)}</td>
                <td className={`${tdClass} hidden md:table-cell`}>{customer?.company_name || '—'}</td>
              </tr>
            );
          })}
        </Table>
        <Pagination page={page.page} pageCount={page.pageCount} total={page.total} onPage={page.setPage} />
      </DataState>
    </Page>
  );
};
