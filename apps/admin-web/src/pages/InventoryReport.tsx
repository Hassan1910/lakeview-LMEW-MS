import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { Button, Card, Page, Table, errorMessage } from '../components/ui';
import { downloadCsv } from '../lib/csv';

export const InventoryReport: React.FC = () => {
  const { can } = useAuth();
  const query = useQuery({
    queryKey: ['inventory-report'],
    queryFn: async () => {
      const { data, error } = await db().from('inventory_items').select('name, sku, quantity_on_hand, reorder_level, unit_cost').eq('is_active', true).order('name');
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        onHand: Number(row.quantity_on_hand),
        reorder: Number(row.reorder_level),
        value: Number(row.quantity_on_hand) * Number(row.unit_cost ?? 0),
      }));
    },
  });
  const rows = query.data ?? [];
  const low = rows.filter((row) => row.onHand <= row.reorder);
  const stockValue = rows.reduce((sum, row) => sum + row.value, 0);

  const exportCsv = () => downloadCsv('inventory-report.csv', ['sku', 'name', 'on_hand', 'reorder_level', 'stock_value_kes'], rows.map((row) => [row.sku, row.name, row.onHand, row.reorder, row.value.toFixed(2)]));

  return (
    <Page title="Stock report" description="Stock on hand against reorder levels." actions={can('inventory.export') ? <Button variant="secondary" onClick={exportCsv} disabled={!rows.length}>Export CSV</Button> : null}>
      <DataState loading={query.isLoading} error={errorMessage(query.error)} empty={!rows.length} emptyLabel="No active stock to report on.">
        <div className="grid gap-4 md:grid-cols-3">
          <Card title="Active items"><p className="text-3xl font-semibold">{rows.length}</p></Card>
          <Card title="At or below reorder"><p className="text-3xl font-semibold text-amber-600">{low.length}</p></Card>
          <Card title="Stock value at cost"><p className="text-3xl font-semibold">KES {stockValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p></Card>
        </div>
        <Card title="On hand by item">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows}>
                <XAxis dataKey="sku" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip formatter={(value: number, _name, entry) => [`${value} (reorder ${entry.payload.reorder})`, entry.payload.name]} />
                <Bar dataKey="onHand">
                  {rows.map((row) => <Cell key={row.sku} fill={row.onHand <= row.reorder ? '#d97706' : '#0B4F6C'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        {low.length ? (
          <Card title="Reorder now">
            <Table head={['SKU', 'Name', 'On hand', 'Reorder level']}>
              {low.map((row) => (
                <tr key={row.sku}><td className="px-3 py-2 font-mono text-xs">{row.sku}</td><td className="px-3 py-2">{row.name}</td><td className="px-3 py-2">{row.onHand}</td><td className="px-3 py-2">{row.reorder}</td></tr>
              ))}
            </Table>
          </Card>
        ) : null}
      </DataState>
    </Page>
  );
};
