import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db, watch } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { navModules } from '../auth/access';
import { formatMoney, formatWhen, statusLabel } from '../lib/format';
import { useLowStockCount } from '../lib/lowStock';
import { Card, EmptyState, Kpi, Notice, Page, SkeletonRows, linkClass } from '../components/ui';

const none = Promise.resolve({ data: [] as never[], error: null });

type RequestRow = { id: string; code: string | null; title: string | null; status: string; created_at: string };
type InvoiceRow = { id: string; code: string | null; total: number; status: string; created_at: string };
type ActivityRow = { id: number; action: string; entity: string; actor_email: string | null; created_at: string };

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
  const lowStock = useLowStockCount(show.stock);
  const query = useQuery({
    queryKey: ['dashboard', [...Object.values(show)].join()],
    queryFn: async () => {
      const metricsResult = await db().rpc('dashboard_metrics');
      if (metricsResult.error) throw metricsResult.error;
      const metrics = (metricsResult.data ?? {}) as {
        open_requests?: number;
        revenue_mtd?: number;
        jobs_today?: number;
        open_orders?: number;
        requests_by_status?: { name: string; value: number }[];
        revenue_trend?: { name: string; value: number }[];
      };
      const [requests, invoices, orders, activity, purchases] = await Promise.all([
        show.requests ? db().from('service_requests').select('id, code, title, status, created_at').order('created_at', { ascending: false }).limit(5) : none,
        show.revenue ? db().from('invoices').select('id, code, total, status, created_at').order('created_at', { ascending: false }).limit(5) : none,
        show.jobs ? db().from('work_orders').select('id, code, status, created_at').order('created_at', { ascending: false }).limit(5) : none,
        show.activity ? db().from('audit_logs').select('id, action, entity, actor_email, created_at').order('created_at', { ascending: false }).limit(8) : none,
        show.orders ? db().from('purchase_orders').select('id, code, status').not('status', 'in', '(received,cancelled)').order('created_at', { ascending: false }).limit(5) : none,
      ]);
      const failed = requests.error ?? invoices.error ?? orders.error ?? activity.error ?? purchases.error;
      if (failed) throw failed;
      return {
        open: Number(metrics.open_requests ?? 0),
        revenue: Number(metrics.revenue_mtd ?? 0),
        jobsToday: Number(metrics.jobs_today ?? 0),
        openOrders: Number(metrics.open_orders ?? 0),
        byStatus: (metrics.requests_by_status ?? []).map((row) => ({ name: statusLabel(row.name), value: Number(row.value) })),
        trend: (metrics.revenue_trend ?? []).map((row) => ({ name: row.name, value: Number(row.value) })),
        activity: (activity.data ?? []) as ActivityRow[],
        recentRequests: (requests.data ?? []) as RequestRow[],
        recentInvoices: (invoices.data ?? []) as InvoiceRow[],
        recentJobs: (orders.data ?? []) as { id: string; code: string | null; status: string; created_at: string }[],
        recentOrders: (purchases.data ?? []) as { id: string; code: string | null; status: string }[],
      };
    },
  });
  useEffect(() => {
    const stops: (() => void)[] = [];
    if (show.requests) stops.push(watch('service_requests', () => queryClient.invalidateQueries({ queryKey: ['dashboard'] })));
    if (show.stock) stops.push(watch('inventory_items', () => queryClient.invalidateQueries({ queryKey: ['low-stock-count'] })));
    return () => stops.forEach((stop) => stop());
  }, [queryClient, show.requests, show.stock]);

  const data = query.data;
  const low = lowStock.data ?? 0;
  const first = profile?.full_name?.split(' ')[0] ?? 'there';
  const cards = [
    show.requests && { label: 'Open requests', value: data?.open ?? 0, to: '/service-requests' },
    show.revenue && { label: 'Revenue this month', value: formatMoney(data?.revenue), to: '/invoices' },
    show.jobs && { label: 'Jobs today', value: data?.jobsToday ?? 0, to: '/work-orders' },
    show.stock && { label: 'Low stock', value: lowStock.isLoading ? '—' : low, to: '/inventory', hint: low ? 'At or below reorder' : 'Stock is above reorder' },
    show.orders && { label: 'Open purchase orders', value: data?.openOrders ?? 0, to: '/purchase-orders' },
  ].filter(Boolean) as { label: string; value: React.ReactNode; to: string; hint?: string }[];

  const pending = [
    show.requests && (data?.open ?? 0) > 0 ? { label: `${data?.open} open service requests`, to: '/service-requests' } : null,
    show.stock && low > 0 ? { label: `${low} parts at or below reorder`, to: '/inventory' } : null,
    show.orders && (data?.openOrders ?? 0) > 0 ? { label: `${data?.openOrders} purchase orders still open`, to: '/purchase-orders' } : null,
  ].filter(Boolean) as { label: string; to: string }[];

  const shortcuts = navModules(can).filter((item) => item.section !== 'Overview').slice(0, 8);

  return (
    <Page title={`Welcome, ${first}`} description={`${role?.name ?? 'Staff'} workspace. The figures below follow the modules you can open.`}>
      {query.isLoading ? <SkeletonRows rows={3} /> : null}
      {query.error ? <Notice tone="error">{query.error instanceof Error ? query.error.message : 'Could not load the dashboard.'}</Notice> : null}
      {!query.isLoading && !query.error ? (
        <>
          {cards.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {cards.map((card) => <Kpi key={card.label} {...card} />)}
            </div>
          ) : <EmptyState title="No summary figures for this role" description="Use the shortcuts below to open the modules assigned to you." />}

          {pending.length ? (
            <Card title="Needs attention">
              <ul className="space-y-2">
                {pending.map((item) => (
                  <li key={item.to}><Link className={linkClass} to={item.to}>{item.label}</Link></li>
                ))}
              </ul>
            </Card>
          ) : null}

          {show.activity ? (
            <Card title="Recent activity" action={<Link className={`text-sm ${linkClass}`} to="/audit">Audit log</Link>}>
              {(data?.activity.length ?? 0) === 0 ? <p className="text-sm text-slate-500">No audit activity yet.</p> : (
                <ul className="space-y-2">
                  {data?.activity.map((item) => (
                    <li key={item.id} className="text-sm text-slate-700 dark:text-slate-200">
                      <span className="text-slate-500">{formatWhen(item.created_at)}</span>
                      {' · '}{item.actor_email ?? 'system'} · {item.action.replace(/_/g, ' ')} · {item.entity.replace(/_/g, ' ')}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          {show.requests || show.revenue ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {show.requests ? (
                <Card title="Requests by status">
                  {(data?.byStatus.length ?? 0) === 0 ? <p className="text-sm text-slate-500">No request activity yet.</p> : (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data?.byStatus}>
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-24} height={56} textAnchor="end" />
                          <YAxis allowDecimals={false} width={32} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#0B4F6C" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card>
              ) : null}
              {show.revenue ? (
                <Card title="Revenue trend">
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data?.trend}>
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis width={48} />
                        <Tooltip />
                        <Area dataKey="value" stroke="#0B4F6C" fill="#0B4F6C" fillOpacity={0.12} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              ) : null}
            </div>
          ) : null}

          {show.requests || show.revenue || show.jobs || show.orders ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {show.requests ? (
                <Card title="Recent requests" action={<Link className={`text-sm ${linkClass}`} to="/service-requests">All requests</Link>}>
                  {(data?.recentRequests.length ?? 0) === 0 ? <p className="text-sm text-slate-500">No requests yet.</p> : (
                    <ul className="space-y-2 text-sm">
                      {data?.recentRequests.map((row) => (
                        <li key={row.id} className="flex items-center justify-between gap-3">
                          <Link className={linkClass} to={`/service-requests/${row.id}`}>{row.code ?? row.title ?? 'Request'}</Link>
                          <span className="text-slate-500">{statusLabel(row.status)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              ) : null}
              {show.revenue ? (
                <Card title="Recent invoices" action={<Link className={`text-sm ${linkClass}`} to="/invoices">All invoices</Link>}>
                  {(data?.recentInvoices.length ?? 0) === 0 ? <p className="text-sm text-slate-500">No invoices yet.</p> : (
                    <ul className="space-y-2 text-sm">
                      {data?.recentInvoices.map((row) => (
                        <li key={row.id} className="flex items-center justify-between gap-3">
                          <Link className={linkClass} to={`/invoices/${row.id}`}>{row.code ?? 'Invoice'}</Link>
                          <span className="text-slate-500">{statusLabel(row.status)} · {formatMoney(row.total)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              ) : null}
              {show.jobs ? (
                <Card title="Recent jobs" action={<Link className={`text-sm ${linkClass}`} to="/work-orders">All jobs</Link>}>
                  {(data?.recentJobs.length ?? 0) === 0 ? <p className="text-sm text-slate-500">No jobs yet.</p> : (
                    <ul className="space-y-2 text-sm">
                      {data?.recentJobs.map((row) => (
                        <li key={row.id} className="flex items-center justify-between gap-3">
                          <Link className={linkClass} to={`/work-orders/${row.id}`}>{row.code ?? 'Work order'}</Link>
                          <span className="text-slate-500">{statusLabel(row.status)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              ) : null}
              {show.orders ? (
                <Card title="Open purchase orders" action={<Link className={`text-sm ${linkClass}`} to="/purchase-orders">All orders</Link>}>
                  {(data?.recentOrders.length ?? 0) === 0 ? <p className="text-sm text-slate-500">No open purchase orders.</p> : (
                    <ul className="space-y-2 text-sm">
                      {data?.recentOrders.map((row) => (
                        <li key={row.id} className="flex items-center justify-between gap-3">
                          <Link className={linkClass} to={`/purchase-orders/${row.id}`}>{row.code ?? 'Draft order'}</Link>
                          <span className="text-slate-500">{statusLabel(row.status)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              ) : null}
            </div>
          ) : null}

          {shortcuts.length ? (
            <Card title="Shortcuts">
              <div className="flex flex-wrap gap-2">
                {shortcuts.map((item) => (
                  <Link key={item.path} to={item.path} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">{item.label}</Link>
                ))}
              </div>
            </Card>
          ) : null}
        </>
      ) : null}
    </Page>
  );
};
