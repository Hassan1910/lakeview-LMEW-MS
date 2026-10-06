import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db, watch } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { navModules } from '../auth/access';
import { DataState } from '../components/DataState';

const none = Promise.resolve({ data: [] as never[], error: null });

export const Dashboard: React.FC = () => {
  const { can, role, profile } = useAuth();
  const queryClient = useQueryClient();
  const show = {
    requests: can('service_requests.view'),
    revenue: can('invoices.view'),
    jobs: can('work_orders.view'),
    stock: can('inventory.view'),
    activity: can('audit.view'),
    orders: can('purchase_orders.view'),
  };
  const query = useQuery({
    queryKey: ['dashboard', [...Object.values(show)].join()],
    queryFn: async () => {
      const [requests, invoices, orders, stock, activity, purchases] = await Promise.all([
        show.requests ? db().from('service_requests').select('id, status, created_at') : none,
        show.revenue ? db().from('invoices').select('total, status, amount_paid, created_at') : none,
        show.jobs ? db().from('work_orders').select('id, created_at') : none,
        show.stock ? db().from('inventory_items').select('id, quantity_on_hand, reorder_level') : none,
        show.activity ? db().from('audit_logs').select('id, action, entity, actor_email, created_at').order('created_at', { ascending: false }).limit(8) : none,
        show.orders ? db().from('purchase_orders').select('id, status') : none,
      ]);
      const failed = requests.error ?? invoices.error ?? orders.error ?? stock.error ?? activity.error ?? purchases.error;
      if (failed) throw failed;
      const open = (requests.data ?? []).filter((row: { status: string }) => !['completed', 'cancelled'].includes(row.status)).length;
      const month = new Date().toISOString().slice(0, 7);
      const paid = (invoices.data ?? []) as { total: number; status: string; created_at: string }[];
      const revenue = paid.filter((row) => row.status === 'paid' && row.created_at?.startsWith(month)).reduce((sum, row) => sum + Number(row.total ?? 0), 0);
      const today = new Date().toISOString().slice(0, 10);
      const jobsToday = (orders.data ?? []).filter((row: { created_at: string }) => row.created_at?.startsWith(today)).length;
      const low = (stock.data ?? []).filter((row: { quantity_on_hand: number; reorder_level: number }) => Number(row.quantity_on_hand) <= Number(row.reorder_level)).length;
      const openOrders = (purchases.data ?? []).filter((row: { status: string }) => !['received', 'cancelled'].includes(row.status)).length;
      const byStatus = Object.entries((requests.data ?? []).reduce<Record<string, number>>((acc, row: { status: string }) => {
        acc[row.status] = (acc[row.status] ?? 0) + 1;
        return acc;
      }, {})).map(([name, value]) => ({ name, value }));
      const trend = Array.from({ length: 6 }, (_, index) => {
        const date = new Date();
        date.setMonth(date.getMonth() - (5 - index));
        const key = date.toISOString().slice(0, 7);
        const value = paid.filter((row) => row.status === 'paid' && row.created_at?.startsWith(key)).reduce((sum, row) => sum + Number(row.total ?? 0), 0);
        return { name: key, value };
      });
      return { open, revenue, jobsToday, low, openOrders, byStatus, trend, activity: (activity.data ?? []) as { id: number; action: string; entity: string; actor_email: string | null; created_at: string }[] };
    },
  });
  useEffect(() => {
    const stops: (() => void)[] = [];
    if (show.requests) stops.push(watch('service_requests', () => queryClient.invalidateQueries({ queryKey: ['dashboard'] })));
    if (show.stock) stops.push(watch('inventory_items', () => queryClient.invalidateQueries({ queryKey: ['dashboard'] })));
    return () => stops.forEach((stop) => stop());
  }, [queryClient, show.requests, show.stock]);

  const data = query.data;
  const shortcuts = navModules(can).filter((item) => item.section !== 'Overview').slice(0, 8);
  const cards = [
    show.requests && { label: 'Open requests', value: data?.open, to: '/service-requests' },
    show.revenue && { label: 'Revenue MTD (KES)', value: data?.revenue, to: '/invoices' },
    show.jobs && { label: 'Jobs today', value: data?.jobsToday, to: '/work-orders' },
    show.stock && { label: 'Low stock', value: data?.low, to: '/inventory' },
    show.orders && { label: 'Open purchase orders', value: data?.openOrders, to: '/purchase-orders' },
  ].filter(Boolean) as { label: string; value?: number; to: string }[];

  return (
    <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null}>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Welcome, {profile?.full_name?.split(' ')[0]}</h1>
        <p className="text-sm text-slate-500">{role?.name} dashboard</p>
      </div>
      {cards.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => <Card key={card.label} {...card} />)}
        </div>
      ) : null}
      {show.requests || show.revenue ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {show.requests ? (
            <div className="h-64 rounded bg-white p-4 dark:bg-slate-900">
              <h2 className="mb-2 text-sm font-semibold">Requests by status</h2>
              {(data?.byStatus.length ?? 0) === 0 ? <p>No request activity yet.</p> : (
                <ResponsiveContainer width="100%" height="85%">
                  <BarChart data={data?.byStatus}><XAxis dataKey="name" hide /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#0B4F6C" /></BarChart>
                </ResponsiveContainer>
              )}
            </div>
          ) : null}
          {show.revenue ? (
            <div className="h-64 rounded bg-white p-4 dark:bg-slate-900">
              <h2 className="mb-2 text-sm font-semibold">Revenue trend</h2>
              <ResponsiveContainer width="100%" height="85%">
                <AreaChart data={data?.trend}><XAxis dataKey="name" /><YAxis /><Tooltip /><Area dataKey="value" stroke="#0B4F6C" fill="#01BAEF" /></AreaChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </div>
      ) : null}
      {shortcuts.length ? (
        <section className="mt-6 rounded bg-white p-4 dark:bg-slate-900">
          <h2 className="font-semibold">Your workspace</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {shortcuts.map((item) => <Link key={item.path} to={item.path} className="rounded border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">{item.label}</Link>)}
          </div>
        </section>
      ) : null}
      {show.activity ? (
        <section className="mt-6 rounded bg-white p-4 dark:bg-slate-900">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Recent activity</h2><Link className="text-sm text-[#0B4F6C] hover:underline dark:text-sky-300" to="/audit">Audit log</Link></div>
          {(data?.activity.length ?? 0) === 0 ? <p className="mt-2 text-sm">No audit activity yet.</p> : data?.activity.map((item) => (
            <p key={item.id} className="mt-1 text-sm">{new Date(item.created_at).toLocaleString()} · {item.actor_email ?? 'system'} · {item.action} · {item.entity.replace(/_/g, ' ')}</p>
          ))}
        </section>
      ) : null}
    </DataState>
  );
};

function Card({ label, value, to }: { label: string; value?: number; to: string }) {
  return (
    <Link to={to} className="block rounded bg-white p-4 shadow hover:ring-2 hover:ring-[#01BAEF] dark:bg-slate-900">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold">{(value ?? 0).toLocaleString()}</p>
    </Link>
  );
}
