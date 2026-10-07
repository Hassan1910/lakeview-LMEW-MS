import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { formatMoney, statusLabel } from '../lib/format';
import { DataState } from '../components/DataState';
import { Button, Card, Field, Notice, Page, Table, inputClass, tdClass } from '../components/ui';

export const Reports: React.FC = () => {
  const { can } = useAuth();
  const showService = can('service_requests.view_reports');
  const showFinance = can('invoices.view_reports');
  const showTech = can('service_requests.view_reports') && can('work_orders.view');
  const showInventory = can('inventory.view_reports');
  const showFeedback = can('feedback.view');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const range = {
    p_from: from ? new Date(from).toISOString() : null,
    p_to: to ? new Date(`${to}T23:59:59`).toISOString() : null,
  };
  const query = useQuery({
    queryKey: ['reports', from, to, showService, showFinance, showTech, showInventory, showFeedback],
    queryFn: async () => {
      const idle = Promise.resolve({ data: [] as never[], error: null });
      const [service, finance, technicians, stock, feedback] = await Promise.all([
        showService ? db().rpc('report_service_counts', range) : idle,
        showFinance ? db().rpc('report_invoice_summary', range) : idle,
        showTech ? db().rpc('report_technician_load') : idle,
        showInventory ? db().rpc('report_low_stock') : idle,
        showFeedback ? db().rpc('report_feedback_summary', range) : idle,
      ]);
      const failed = service.error ?? finance.error ?? technicians.error ?? stock.error ?? feedback.error;
      if (failed) throw failed;
      const financialRows = (finance.data ?? []) as { status: string; value: number; invoiced: number; collected: number }[];
      const feedbackRow = ((feedback.data ?? []) as { average: number; responses: number }[])[0];
      return {
        service: ((service.data ?? []) as { status: string; value: number }[]).map((row) => ({ name: row.status, label: statusLabel(row.status), value: Number(row.value) })),
        financial: financialRows.map((row) => ({ name: row.status, label: statusLabel(row.status), value: Number(row.value) })),
        collected: financialRows.reduce((sum, row) => sum + Number(row.collected ?? 0), 0),
        invoiced: financialRows.reduce((sum, row) => sum + Number(row.invoiced ?? 0), 0),
        technicians: ((technicians.data ?? []) as { name: string; completed: number; open: number }[]).map((row) => ({ name: row.name, completed: Number(row.completed), open: Number(row.open) })),
        inventory: (stock.data ?? []) as { name: string; sku: string; quantity_on_hand: number; reorder_level: number }[],
        feedbackAverage: Number(feedbackRow?.average ?? 0),
        feedbackCount: Number(feedbackRow?.responses ?? 0),
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
      ...(showFeedback ? [`feedback,average,${data.feedbackAverage}`] : []),
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

  return (
    <Page title="Reports" description="Operational totals for the modules you can report on." actions={(
      <>
        <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
        <Button variant="secondary" onClick={exportPdf}>Export PDF</Button>
      </>
    )}>
      <Notice tone="error">{error}</Notice>
      <Notice tone="success">{message}</Notice>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="From"><input className={inputClass} type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field>
        <Field label="To"><input className={inputClass} type="date" value={to} onChange={(event) => setTo(event.target.value)} /></Field>
      </div>
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
            <p className="text-sm">Average rating <span className="font-semibold">{(query.data?.feedbackAverage ?? 0).toFixed(2)} / 5</span> from {query.data?.feedbackCount ?? 0} responses.</p>
          </Card>
        ) : null}
      </DataState>
    </Page>
  );
};
