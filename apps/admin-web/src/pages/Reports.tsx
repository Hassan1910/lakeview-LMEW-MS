import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';

export const Reports: React.FC = () => {
  const { can } = useAuth();
  const showService = can('service_requests.view_reports');
  const showFinance = can('invoices.view_reports');
  const showTech = can('service_requests.view_reports') && can('work_orders.view');
  const showInventory = can('inventory.view_reports');
  const showFeedback = can('feedback.view');
  const [message, setMessage] = useState<string | null>(null);
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
      }, {})).map(([name, value]) => ({ name, value }));
      const technicians = new Map<string, { name: string; completed: number; open: number }>();
      for (const row of orders.data ?? []) {
        const technician = Array.isArray(row.technician) ? row.technician[0] : row.technician;
        const name = technician?.full_name ?? row.assigned_to;
        const current = technicians.get(row.assigned_to) ?? { name, completed: 0, open: 0 };
        if (row.status === 'completed') current.completed += 1;
        else if (row.status !== 'cancelled') current.open += 1;
        technicians.set(row.assigned_to, current);
      }
      const financial = count(invoices.data);
      return {
        service: count(requests.data),
        financial,
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
    const { data, error } = await db().functions.invoke('generate-pdf', {
      body: { type: 'report', id: crypto.randomUUID(), title: 'Lakeview Marine operations report', rows: csvLines().slice(1) },
    });
    if (error || data?.error) setMessage(error?.message ?? data.error);
    else { setMessage('PDF ready'); window.open(data.signed_url, '_blank'); }
  };

  const avg = average(query.data?.feedback ?? []);

  return (
    <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null}>
      <div className="mb-3 flex gap-2">
        <button onClick={exportCsv}>Export CSV</button>
        <button onClick={exportPdf}>Export PDF</button>
      </div>
      {message ? <p>{message}</p> : null}
      {showService ? (
        <>
          <h2 className="font-semibold">Service report</h2>
          <div className="h-48">{(query.data?.service.length ?? 0) === 0 ? <p>No service data.</p> : <ResponsiveContainer width="100%" height="100%"><BarChart data={query.data?.service}><XAxis dataKey="name" hide /><YAxis /><Tooltip /><Bar dataKey="value" fill="#0B4F6C" /></BarChart></ResponsiveContainer>}</div>
        </>
      ) : null}
      {showFinance ? (
        <>
          <h2 className="mt-4 font-semibold">Financial report</h2>
          <p>Invoiced KES {query.data?.invoiced ?? 0} · collected KES {query.data?.collected ?? 0}</p>
          {(query.data?.financial ?? []).map((row) => <p key={row.name}>{row.name}: {row.value}</p>)}
        </>
      ) : null}
      {showTech ? (
        <>
          <h2 className="mt-4 font-semibold">Technician performance</h2>
          {(query.data?.technicians ?? []).map((row) => <p key={row.name}>{row.name}: {row.completed} completed, {row.open} open</p>)}
          {(query.data?.technicians.length ?? 0) === 0 ? <p>No technician jobs yet.</p> : null}
        </>
      ) : null}
      {showInventory ? (
        <>
          <h2 className="mt-4 font-semibold">Inventory at or below reorder</h2>
          {(query.data?.inventory ?? []).map((row) => <p key={row.sku}>{row.name} ({row.sku}): {row.quantity_on_hand} / reorder {row.reorder_level}</p>)}
          {(query.data?.inventory.length ?? 0) === 0 ? <p>No items are below reorder.</p> : null}
        </>
      ) : null}
      {showFeedback ? (
        <>
          <h2 className="mt-4 font-semibold">Customer feedback</h2>
          <p>Average rating {avg.toFixed(2)} / 5 from {query.data?.feedback.length ?? 0} responses</p>
        </>
      ) : null}
    </DataState>
  );
};

function average(rows: { rating: number }[]) {
  if (!rows.length) return 0;
  return rows.reduce((sum, row) => sum + Number(row.rating), 0) / rows.length;
}
