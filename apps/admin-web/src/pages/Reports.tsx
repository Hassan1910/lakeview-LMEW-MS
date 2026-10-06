import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { formatMoney, statusLabel } from '../lib/format';
import { DataState } from '../components/DataState';
import { Button, Card, Notice, Page, Table, tdClass } from '../components/ui';

export const Reports: React.FC = () => {
  const { can } = useAuth();
  const showService = can('service_requests.view_reports');
  const showFinance = can('invoices.view_reports');
  const showTech = can('service_requests.view_reports') && can('work_orders.view');
  const showInventory = can('inventory.view_reports');
  const showFeedback = can('feedback.view');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      const [requests, invoices, orders, stock, feedback] = await Promise.all([
        db().from('service_requests').select('status'),
        db().from('invoices').select('status, total, amount_paid'),
        db().from('work_orders').select('status, assigned_to, technician:profiles!work_orders_assigned_to_fkey(full_name)'),
        db().from('inventory_items').select('name, sku, quantity_on_hand, reorder_level'),
        db().from('feedback').select('rating, category'),
      ]);
      const count = (rows: { status?: string }[] | null) => Object.entries((rows ?? []).reduce<Record<string, number>>((acc, row) => {
        const name = String(row.status ?? 'unknown');
        acc[name] = (acc[name] ?? 0) + 1;
        return acc;
      }, {})).map(([name, value]) => ({ name, label: statusLabel(name), value }));
      const technicians = new Map<string, { name: string; completed: number; open: number }>();
      for (const row of orders.data ?? []) {
        const technician = Array.isArray(row.technician) ? row.technician[0] : row.technician;
        const name = technician?.full_name ?? row.assigned_to;
        const current = technicians.get(row.assigned_to) ?? { name, completed: 0, open: 0 };
        if (row.status === 'completed') current.completed += 1;
        else if (row.status !== 'cancelled') current.open += 1;
        technicians.set(row.assigned_to, current);
      }
      return {
        service: count(requests.data),
        financial: count(invoices.data),
        collected: (invoices.data ?? []).reduce((sum, row) => sum + Number(row.amount_paid ?? 0), 0),
        invoiced: (invoices.data ?? []).reduce((sum, row) => sum + Number(row.total ?? 0), 0),
        technicians: [...technicians.values()],
        inventory: (stock.data ?? []).filter((row) => Number(row.quantity_on_hand) <= Number(row.reorder_level)),
        feedback: feedback.data ?? [],
      };
    },
  });

  const csvLines = () => {
    const data = query.data;
    if (!data) return [];
    return [
      'section,name,value',
      ...(showService ? data.service.map((row) => `service,${row.name},${row.value}`) : []),
      ...(showFinance ? data.financial.map((row) => `financial,${row.name},${row.value}`) : []),
      ...(showTech ? data.technicians.map((row) => `technician,${row.name},${row.completed} completed / ${row.open} open`) : []),
      ...(showInventory ? data.inventory.map((row) => `inventory,${row.sku},${row.quantity_on_hand}`) : []),
      ...(showFeedback ? [`feedback,average,${average(data.feedback)}`] : []),
    ];
  };

  const exportCsv = () => {
    const blob = new Blob([csvLines().join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lmew-report.csv';
    link.click();
  };
  const exportPdf = async () => {
    setError(null);
    setMessage(null);
    const { data, error: invokeError } = await db().functions.invoke('generate-pdf', {
      body: { type: 'report', id: crypto.randomUUID(), title: 'Lakeview Marine operations report', rows: csvLines().slice(1) },
    });
    if (invokeError || data?.error) setError(invokeError?.message ?? data.error);
    else { setMessage('PDF ready.'); window.open(data.signed_url, '_blank'); }
  };

  const avg = average(query.data?.feedback ?? []);

  return (
    <Page title="Reports" description="Operational totals for the modules you can report on." actions={(
      <>
        <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
        <Button variant="secondary" onClick={exportPdf}>Export PDF</Button>
      </>
    )}>
      <Notice tone="error">{error}</Notice>
      <Notice tone="success">{message}</Notice>
      <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null}>
        {showService ? (
          <Card title="Service requests">
            {(query.data?.service.length ?? 0) === 0 ? <p className="text-sm text-slate-500">No service data.</p> : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={query.data?.service}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-24} height={64} textAnchor="end" />
                    <YAxis allowDecimals={false} width={32} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0B4F6C" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        ) : null}
        {showFinance ? (
          <Card title="Finance">
            <div className="mb-3 grid gap-3 sm:grid-cols-2">
              <p className="text-sm">Invoiced <span className="font-semibold">{formatMoney(query.data?.invoiced)}</span></p>
              <p className="text-sm">Collected <span className="font-semibold">{formatMoney(query.data?.collected)}</span></p>
            </div>
            <ul className="space-y-1 text-sm">
              {(query.data?.financial ?? []).map((row) => <li key={row.name} className="flex justify-between gap-3"><span>{row.label}</span><span>{row.value}</span></li>)}
            </ul>
          </Card>
        ) : null}
        {showTech ? (
          <Card title="Technician performance">
            {(query.data?.technicians.length ?? 0) === 0 ? <p className="text-sm text-slate-500">No technician jobs yet.</p> : (
              <Table head={['Technician', 'Completed', 'Open']}>
                {(query.data?.technicians ?? []).map((row) => (
                  <tr key={row.name}>
                    <td className={tdClass}>{row.name}</td>
                    <td className={tdClass}>{row.completed}</td>
                    <td className={tdClass}>{row.open}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        ) : null}
        {showInventory ? (
          <Card title="Inventory at or below reorder">
            {(query.data?.inventory.length ?? 0) === 0 ? <p className="text-sm text-slate-500">No items are below reorder.</p> : (
              <Table head={['Item', 'SKU', 'On hand', 'Reorder']}>
                {(query.data?.inventory ?? []).map((row) => (
                  <tr key={row.sku}>
                    <td className={tdClass}>{row.name}</td>
                    <td className={tdClass}>{row.sku}</td>
                    <td className={tdClass}>{row.quantity_on_hand}</td>
                    <td className={tdClass}>{row.reorder_level}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        ) : null}
        {showFeedback ? (
          <Card title="Customer feedback">
            <p className="text-sm">Average rating <span className="font-semibold">{avg.toFixed(2)} / 5</span> from {query.data?.feedback.length ?? 0} responses.</p>
          </Card>
        ) : null}
      </DataState>
    </Page>
  );
};

function average(rows: { rating: number }[]) {
  if (!rows.length) return 0;
  return rows.reduce((sum, row) => sum + Number(row.rating), 0) / rows.length;
}
