import React, { useState } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { useConfirm } from '../components/confirm';
import { Button, Notice, Page, StatusBadge, Table, errorMessage } from '../components/ui';

export const MyOrders: React.FC = () => {
  const { profile, can } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['my-orders', profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const supplier = await db().from('suppliers').select('id, name').eq('profile_id', profile!.id).maybeSingle();
      if (supplier.error) throw supplier.error;
      if (!supplier.data) return { supplier: null, orders: [] };
      const { data, error: listError } = await db()
        .from('purchase_orders')
        .select('id, code, status, total, currency, expected_date, created_at')
        .eq('supplier_id', supplier.data.id)
        .neq('status', 'draft')
        .order('created_at', { ascending: false });
      if (listError) throw listError;
      return { supplier: supplier.data, orders: data ?? [] };
    },
  });

  const setStatus = async (id: string, status: string) => {
    const ok = await confirm({
      title: status === 'shipped' ? 'Mark shipped' : 'Acknowledge order',
      description: status === 'shipped' ? 'Tell Lakeview Marine this order has shipped?' : 'Acknowledge that you received this purchase order?',
      confirmLabel: status === 'shipped' ? 'Mark shipped' : 'Acknowledge',
      tone: 'primary',
    });
    if (!ok) return;
    setError(null);
    const { error: updateError } = await db().from('purchase_orders').update({ status }).eq('id', id);
    if (updateError) setError(updateError.message);
    queryClient.invalidateQueries({ queryKey: ['my-orders'] });
  };

  const orders = query.data?.orders ?? [];
  const canUpdate = can('purchase_orders.edit_own');

  return (
    <Page title="My orders" description={query.data?.supplier ? `Purchase orders sent to ${query.data.supplier.name}.` : 'Purchase orders sent to your company.'}>
      <Notice tone="error">{error}</Notice>
      <DataState
        loading={query.isLoading}
        error={errorMessage(query.error)}
        empty={!orders.length}
        emptyLabel={query.data && !query.data.supplier ? 'Your account is not linked to a supplier yet. Ask Lakeview Marine to link it.' : 'No orders have been sent to you yet.'}
      >
        <Table head={['Order', 'Status', 'Total', 'Expected', '']}>
          {orders.map((order) => (
            <tr key={order.id}>
              <td className="px-3 py-2"><Link className="font-medium text-lmew-blue-800 hover:underline dark:text-sky-300" to={`/my-orders/${order.id}`}>{order.code}</Link></td>
              <td className="px-3 py-2"><StatusBadge status={order.status} /></td>
              <td className="px-3 py-2">{order.currency ?? 'KES'} {Number(order.total ?? 0).toLocaleString()}</td>
              <td className="px-3 py-2">{order.expected_date ?? '—'}</td>
              <td className="px-3 py-2 text-right">
                {canUpdate && order.status === 'sent' ? <Button onClick={() => setStatus(order.id, 'acknowledged')}>Acknowledge</Button> : null}{' '}
                {canUpdate && (order.status === 'sent' || order.status === 'acknowledged') ? <Button variant="secondary" onClick={() => setStatus(order.id, 'shipped')}>Mark shipped</Button> : null}
              </td>
            </tr>
          ))}
        </Table>
      </DataState>
    </Page>
  );
};
