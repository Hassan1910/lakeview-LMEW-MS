import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FilePlus, Package, Receipt, ShoppingCart, UserPlus, Users, Wrench, type LucideIcon } from 'lucide-react';
import { db, watch } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { formatMoney, formatWhen, statusLabel } from '../lib/format';
import { useLowStockCount } from '../lib/lowStock';
import { Badge, EmptyState, Kpi, Notice, Page, Skeleton, StatusBadge, linkClass } from '../components/ui';

const none = Promise.resolve({ data: [] as never[], error: null });
const noCount = Promise.resolve({ count: 0, data: null, error: null });

const ACTIVE_JOBS = new Set(['assigned', 'in_progress', 'blocked']);
const UNPAID = new Set(['issued', 'partially_paid', 'overdue']);
const REQUEST_ORDER = ['request_received', 'inspection_in_progress', 'quotation_pending', 'quotation_sent', 'awaiting_approval', 'awaiting_spare_parts', 'under_repair', 'testing', 'completed', 'cancelled'];
const JOB_ORDER = ['assigned', 'in_progress', 'blocked', 'completed', 'cancelled'];
const INVOICE_ORDER = ['draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled'];

type RequestRow = { id: string; code: string | null; title: string | null; status: string; created_at: string };
type InvoiceRow = { id: string; code: string | null; total: number; currency: string | null; status: string; created_at: string };
type JobRow = { id: string; code: string | null; status: string; created_at: string };
type OrderRow = { id: string; code: string | null; status: string };
type ActivityRow = { id: number; action: string; entity: string; actor_email: string | null; created_at: string };
type StatusPoint = { name: string; value: number };

function byWorkflow(names: string[], order: string[]) {
  return [...names].sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi);
  });
}

function groupStatus(rows: { status: string }[], order: string[]): StatusPoint[] {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  return byWorkflow([...counts.keys()], order).map((status) => ({ name: statusLabel(status), value: counts.get(status) ?? 0 }));
}

function revenueHint(trend: StatusPoint[]) {
  if (trend.length < 2) return undefined;
  const previous = trend[trend.length - 2].value;
  const current = trend[trend.length - 1].value;
  if (previous === 0 && current === 0) return undefined;
  if (previous === 0) return 'No paid invoices last month';
  const rounded = Math.round(((current - previous) / previous) * 100);
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}% vs last month`;
}

function monthLabel(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

function actionLabel(action: string) {
  return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function auditResult(action: string): { label: string; tone: 'red' | 'green' | 'amber' | 'blue' } {
  if (/DELETE|REMOVED|SUSPENDED/.test(action)) return { label: 'Removed', tone: 'red' };
  if (/INSERT|CREATED|INVITED|RESTORED/.test(action)) return { label: 'Created', tone: 'green' };
  if (/PASSWORD/.test(action)) return { label: 'Security', tone: 'amber' };
  return { label: 'Updated', tone: 'blue' };
}

function useChartTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return {
    tick: dark ? '#94a3b8' : '#64748b',
    grid: dark ? '#1e293b' : '#e2e8f0',
    tooltip: {
      background: dark ? '#0f172a' : '#ffffff',
      border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`,
      borderRadius: 8,
      fontSize: 12,
      color: dark ? '#e2e8f0' : '#0f172a',
    },
  };
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ChartBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">{title}</h3>
      {children}
    </div>
  );
}

function RecordList({ title, to, empty, children }: { title: string; to: string; empty: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200">{title}</h3>
        <Link className={`shrink-0 text-sm ${linkClass}`} to={to}>View all</Link>
      </div>
      {children ?? <p className="py-3 text-sm text-slate-500">{empty}</p>}
    </div>
  );
}

function RecordRow({ to, title, meta, status }: { to: string; title: string; meta?: string; status: string }) {
  return (
    <li>
      <Link to={to} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-lmew-blue-800 dark:hover:text-sky-200">
        <span className="min-w-0">
          <span className="block truncate font-medium text-slate-800 dark:text-slate-100">{title}</span>
          {meta ? <span className="block truncate text-xs text-slate-500">{meta}</span> : null}
        </span>
        <StatusBadge status={status} />
      </Link>
    </li>
  );
}

export const Dashboard: React.FC = () => {
  const { can, role, profile } = useAuth();
  const queryClient = useQueryClient();
  const chart = useChartTheme();
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
      const [requests, invoices, orders, activity, purchases, jobStatuses, invoiceStatuses, awaiting, drafts, stockCount] = await Promise.all([
        show.requests ? db().from('service_requests').select('id, code, title, status, created_at').order('created_at', { ascending: false }).limit(5) : none,
        show.revenue ? db().from('invoices').select('id, code, total, currency, status, created_at').order('created_at', { ascending: false }).limit(5) : none,
        show.jobs ? db().from('work_orders').select('id, code, status, created_at').order('created_at', { ascending: false }).limit(5) : none,
        show.activity ? db().from('audit_logs').select('id, action, entity, actor_email, created_at').order('created_at', { ascending: false }).limit(5) : none,
        show.orders ? db().from('purchase_orders').select('id, code, status').order('created_at', { ascending: false }).limit(5) : none,
        show.jobs ? db().from('work_orders').select('status, scheduled_end') : none,
        show.revenue ? db().from('invoices').select('status, due_at') : none,
        show.requests ? db().from('service_requests').select('id', { count: 'exact', head: true }).eq('status', 'awaiting_approval') : noCount,
        show.orders ? db().from('purchase_orders').select('id', { count: 'exact', head: true }).eq('status', 'draft') : noCount,
        show.stock ? db().from('inventory_items').select('id', { count: 'exact', head: true }).not('is_active', 'eq', false) : noCount,
      ]);
      const failed = requests.error ?? invoices.error ?? orders.error ?? activity.error ?? purchases.error ?? jobStatuses.error ?? invoiceStatuses.error ?? awaiting.error ?? drafts.error ?? stockCount.error;
      if (failed) throw failed;
      const now = Date.now();
      const jobRows = (jobStatuses.data ?? []) as { status: string; scheduled_end: string | null }[];
      const invoiceRows = (invoiceStatuses.data ?? []) as { status: string; due_at: string | null }[];
      const requestCounts = byWorkflow((metrics.requests_by_status ?? []).map((row) => row.name), REQUEST_ORDER);
      return {
        open: Number(metrics.open_requests ?? 0),
        revenue: Number(metrics.revenue_mtd ?? 0),
        jobsToday: Number(metrics.jobs_today ?? 0),
        openOrders: Number(metrics.open_orders ?? 0),
        activeJobs: jobRows.filter((row) => ACTIVE_JOBS.has(row.status)).length,
        overdueJobs: jobRows.filter((row) => ACTIVE_JOBS.has(row.status) && row.scheduled_end && new Date(row.scheduled_end).getTime() < now).length,
        pendingInvoices: invoiceRows.filter((row) => UNPAID.has(row.status)).length,
        overdueInvoices: invoiceRows.filter((row) => row.status === 'overdue' || (Boolean(row.due_at) && new Date(row.due_at as string).getTime() < now && (row.status === 'issued' || row.status === 'partially_paid'))).length,
        awaitingApproval: awaiting.count ?? 0,
        draftOrders: drafts.count ?? 0,
        activeItems: stockCount.count ?? 0,
        byStatus: requestCounts.map((name) => {
          const match = (metrics.requests_by_status ?? []).find((row) => row.name === name);
          return { name: statusLabel(name), value: Number(match?.value ?? 0) };
        }),
        jobsByStatus: groupStatus(jobRows, JOB_ORDER),
        invoicesByStatus: groupStatus(invoiceRows, INVOICE_ORDER),
        trend: (metrics.revenue_trend ?? []).map((row) => ({ name: monthLabel(row.name), value: Number(row.value) })),
        activity: (activity.data ?? []) as ActivityRow[],
        recentRequests: (requests.data ?? []) as RequestRow[],
        recentInvoices: (invoices.data ?? []) as InvoiceRow[],
        recentJobs: (orders.data ?? []) as JobRow[],
        recentOrders: (purchases.data ?? []) as OrderRow[],
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
    show.requests && { label: 'Open service requests', value: data?.open ?? 0, to: '/service-requests' },
    show.jobs && { label: 'Active work orders', value: data?.activeJobs ?? 0, to: '/work-orders', hint: `${data?.jobsToday ?? 0} opened today` },
    show.revenue && { label: 'Revenue this month', value: formatMoney(data?.revenue), to: '/invoices', hint: data ? revenueHint(data.trend) : undefined },
    show.revenue && { label: 'Pending invoices', value: data?.pendingInvoices ?? 0, to: '/invoices?unpaid=1' },
    show.stock && { label: 'Low stock items', value: lowStock.isLoading || lowStock.isError ? '—' : low, to: '/inventory?low=1', hint: lowStock.isLoading ? undefined : lowStock.isError ? 'Stock count unavailable' : low ? 'At or below reorder' : 'Stock is above reorder' },
    show.orders && { label: 'Pending purchase orders', value: data?.openOrders ?? 0, to: '/purchase-orders?open=1' },
  ].filter(Boolean) as { label: string; value: React.ReactNode; to: string; hint?: string }[];

  const attention = [
    show.requests && (data?.open ?? 0) > 0 ? { label: `${data?.open} open service ${data?.open === 1 ? 'request' : 'requests'}`, to: '/service-requests' } : null,
    show.jobs && (data?.overdueJobs ?? 0) > 0 ? { label: `${data?.overdueJobs} overdue work ${data?.overdueJobs === 1 ? 'order' : 'orders'}`, to: '/work-orders?overdue=1' } : null,
    show.stock && !lowStock.isLoading && !lowStock.isError && low > 0 ? { label: `${low} ${low === 1 ? 'item' : 'items'} at or below reorder`, to: '/inventory?low=1' } : null,
    show.requests && (data?.awaitingApproval ?? 0) > 0 ? { label: `${data?.awaitingApproval} ${data?.awaitingApproval === 1 ? 'request' : 'requests'} awaiting approval`, to: '/service-requests?status=awaiting_approval' } : null,
    show.orders && (data?.draftOrders ?? 0) > 0 ? { label: `${data?.draftOrders} draft purchase ${data?.draftOrders === 1 ? 'order' : 'orders'} to approve`, to: '/purchase-orders?status=draft' } : null,
    show.revenue && (data?.pendingInvoices ?? 0) > 0 ? { label: `${data?.pendingInvoices} unpaid ${data?.pendingInvoices === 1 ? 'invoice' : 'invoices'}`, to: '/invoices?unpaid=1' } : null,
    show.revenue && (data?.overdueInvoices ?? 0) > 0 ? { label: `${data?.overdueInvoices} overdue ${data?.overdueInvoices === 1 ? 'invoice' : 'invoices'}`, to: '/invoices?status=overdue' } : null,
    show.orders && (data?.openOrders ?? 0) > 0 ? { label: `${data?.openOrders} open purchase ${data?.openOrders === 1 ? 'order' : 'orders'}`, to: '/purchase-orders?open=1' } : null,
  ].filter(Boolean) as { label: string; to: string }[];

  const actions = [
    can('users.manage') ? { label: 'Create user', to: '/users?new=1', icon: UserPlus } : null,
    can('customers.create') ? { label: 'Create customer', to: '/reception', icon: Users } : null,
    can('service_requests.create') ? { label: 'New service request', to: '/requests/new', icon: FilePlus } : null,
    can('work_orders.create') ? { label: 'New work order', to: '/service-requests', icon: Wrench } : null,
    can('invoices.approve') ? { label: 'Create invoice', to: '/invoices', icon: Receipt } : null,
    can('purchase_orders.create') ? { label: 'Create purchase order', to: '/purchase-orders', icon: ShoppingCart } : null,
    can('inventory.create') ? { label: 'Add inventory item', to: '/inventory', icon: Package } : null,
  ].filter(Boolean) as { label: string; to: string; icon: LucideIcon }[];

  const operational = show.requests || show.jobs || show.revenue || show.stock || show.orders;
  const healthy = Math.max(0, (data?.activeItems ?? 0) - low);
  const stockTotal = (data?.activeItems ?? 0);
  const showStockBar = show.stock && lowStock.isSuccess && stockTotal > 0;
  const showRevenueChart = (data?.trend.some((point) => point.value > 0) ?? false);
  const axis = { fontSize: 11, fill: chart.tick };

  return (
    <Page title={`Welcome, ${first}`} description={`Open work, revenue, and stock for ${role?.name ?? 'your role'}. Figures follow the modules you can open.`}>
      {query.isLoading ? (
        <div className="space-y-8" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading dashboard</span>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-24" />)}
          </div>
          <Skeleton className="h-24" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      ) : null}
      {query.error ? <Notice tone="error">{query.error instanceof Error ? query.error.message : 'Could not load the dashboard.'}</Notice> : null}
      {!query.isLoading && !query.error ? (
        <div className="space-y-8">
          {cards.length ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {cards.map((card) => <Kpi key={card.label} {...card} />)}
            </div>
          ) : <EmptyState title="No summary figures for this role" description="Open a module from the sidebar to start work." />}

          {operational ? (
            <Section title="Needs attention">
              {attention.length === 0 ? <p className="text-sm text-slate-500">Nothing needs attention right now.</p> : (
                <ul className="divide-y divide-amber-200/80 overflow-hidden rounded-lg bg-amber-50/70 dark:divide-amber-900/50 dark:bg-amber-950/20">
                  {attention.map((item) => (
                    <li key={item.label}>
                      <Link to={item.to} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm text-slate-800 hover:bg-amber-100/80 dark:text-amber-50 dark:hover:bg-amber-950/40">
                        <span>{item.label}</span>
                        <span className="shrink-0 text-xs font-medium text-lmew-blue-800 dark:text-sky-300">Open</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          ) : null}

          {show.requests || show.revenue || showStockBar || (show.jobs && (data?.jobsByStatus.length ?? 0) > 0) ? (
            <Section title="Overview">
              {showStockBar ? (
                <div className="max-w-xl">
                  <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                    <p className="font-medium text-slate-800 dark:text-slate-100">Stock health</p>
                    <p className="text-slate-500">{healthy} above reorder · {low} low</p>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-amber-400/90" role="img" aria-label={`${healthy} items above reorder, ${low} at or below reorder`}>
                    <div className="h-full bg-lmew-blue-800" style={{ width: `${stockTotal === 0 ? 0 : (healthy / stockTotal) * 100}%` }} />
                  </div>
                </div>
              ) : null}
              <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
                {show.requests ? (
                  <ChartBlock title="Service requests by status">
                    {(data?.byStatus.length ?? 0) === 0 ? <p className="text-sm text-slate-500">No request activity yet.</p> : (
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={data?.byStatus} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                            <CartesianGrid stroke={chart.grid} vertical={false} />
                            <XAxis dataKey="name" tick={axis} interval={0} angle={-28} height={68} textAnchor="end" />
                            <YAxis allowDecimals={false} width={32} tick={axis} />
                            <Tooltip contentStyle={chart.tooltip} />
                            <Bar dataKey="value" name="Requests" fill="#0B4F6C" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </ChartBlock>
                ) : null}
                {show.jobs && (data?.jobsByStatus.length ?? 0) > 0 ? (
                  <ChartBlock title="Work orders by status">
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data?.jobsByStatus} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                          <CartesianGrid stroke={chart.grid} vertical={false} />
                          <XAxis dataKey="name" tick={axis} interval={0} angle={-28} height={68} textAnchor="end" />
                          <YAxis allowDecimals={false} width={32} tick={axis} />
                          <Tooltip contentStyle={chart.tooltip} />
                          <Bar dataKey="value" name="Work orders" fill="#0B4F6C" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartBlock>
                ) : null}
                {show.revenue ? (
                  <ChartBlock title="Revenue trend">
                    {showRevenueChart ? (
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={data?.trend} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                            <CartesianGrid stroke={chart.grid} vertical={false} />
                            <XAxis dataKey="name" tick={axis} />
                            <YAxis width={56} tick={axis} />
                            <Tooltip contentStyle={chart.tooltip} formatter={(value) => formatMoney(Number(value))} />
                            <Area dataKey="value" name="Revenue" stroke="#0B4F6C" fill="#0B4F6C" fillOpacity={0.16} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : <p className="text-sm text-slate-500">No paid invoices in the last six months.</p>}
                  </ChartBlock>
                ) : null}
                {show.revenue && (data?.invoicesByStatus.length ?? 0) > 0 ? (
                  <ChartBlock title="Invoices by status">
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data?.invoicesByStatus} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                          <CartesianGrid stroke={chart.grid} vertical={false} />
                          <XAxis dataKey="name" tick={axis} interval={0} angle={-28} height={68} textAnchor="end" />
                          <YAxis allowDecimals={false} width={32} tick={axis} />
                          <Tooltip contentStyle={chart.tooltip} />
                          <Bar dataKey="value" name="Invoices" fill="#0B4F6C" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartBlock>
                ) : null}
              </div>
            </Section>
          ) : null}

          {show.requests || show.jobs || show.revenue || show.orders ? (
            <Section title="Recent records">
              <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
                {show.requests ? (
                  <RecordList title="Recent service requests" to="/service-requests" empty="No requests yet.">
                    {(data?.recentRequests.length ?? 0) === 0 ? null : (
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data?.recentRequests.map((row) => (
                          <RecordRow key={row.id} to={`/service-requests/${row.id}`} title={row.code ?? row.title ?? 'Request'} meta={row.code ? row.title ?? undefined : undefined} status={row.status} />
                        ))}
                      </ul>
                    )}
                  </RecordList>
                ) : null}
                {show.jobs ? (
                  <RecordList title="Recent work orders" to="/work-orders" empty="No work orders yet.">
                    {(data?.recentJobs.length ?? 0) === 0 ? null : (
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data?.recentJobs.map((row) => (
                          <RecordRow key={row.id} to={`/work-orders/${row.id}`} title={row.code ?? 'Work order'} meta={formatWhen(row.created_at)} status={row.status} />
                        ))}
                      </ul>
                    )}
                  </RecordList>
                ) : null}
                {show.revenue ? (
                  <RecordList title="Recent invoices" to="/invoices" empty="No invoices yet.">
                    {(data?.recentInvoices.length ?? 0) === 0 ? null : (
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data?.recentInvoices.map((row) => (
                          <RecordRow key={row.id} to={`/invoices/${row.id}`} title={row.code ?? 'Invoice'} meta={formatMoney(row.total, row.currency ?? 'KES')} status={row.status} />
                        ))}
                      </ul>
                    )}
                  </RecordList>
                ) : null}
                {show.orders ? (
                  <RecordList title="Recent purchase orders" to="/purchase-orders" empty="No purchase orders yet.">
                    {(data?.recentOrders.length ?? 0) === 0 ? null : (
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data?.recentOrders.map((row) => (
                          <RecordRow key={row.id} to={`/purchase-orders/${row.id}`} title={row.code ?? 'Draft order'} status={row.status} />
                        ))}
                      </ul>
                    )}
                  </RecordList>
                ) : null}
              </div>
            </Section>
          ) : null}

          {actions.length ? (
            <Section title="Quick actions">
              <div className="flex flex-wrap gap-2">
                {actions.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.label} to={item.to} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200/80 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:border-lmew-blue-800/40 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                      <Icon className="h-4 w-4 text-lmew-blue-800 dark:text-sky-300" aria-hidden="true" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </Section>
          ) : null}

          {show.activity ? (
            <Section title="Audit log" action={<Link className={`text-sm ${linkClass}`} to="/audit">View full audit log</Link>}>
              {(data?.activity.length ?? 0) === 0 ? <p className="text-sm text-slate-500">No audit activity yet.</p> : (
                <>
                  <ul className="divide-y divide-slate-100 sm:hidden dark:divide-slate-800">
                    {data?.activity.map((item) => {
                      const result = auditResult(item.action);
                      return (
                        <li key={item.id} className="space-y-1 py-3 text-sm">
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-medium text-slate-800 dark:text-slate-100">{item.actor_email ?? 'system'}</p>
                            <Badge tone={result.tone}>{result.label}</Badge>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300">{actionLabel(item.action)} · {statusLabel(item.entity)}</p>
                          <p className="text-xs text-slate-500">{formatWhen(item.created_at)}</p>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="hidden overflow-x-auto sm:block">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="py-2 pr-3 font-medium">User</th>
                          <th className="py-2 pr-3 font-medium">Action</th>
                          <th className="py-2 pr-3 font-medium">Module</th>
                          <th className="py-2 pr-3 font-medium">When</th>
                          <th className="py-2 font-medium">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data?.activity.map((item) => {
                          const result = auditResult(item.action);
                          return (
                            <tr key={item.id}>
                              <td className="py-2.5 pr-3 text-slate-800 dark:text-slate-100">{item.actor_email ?? 'system'}</td>
                              <td className="py-2.5 pr-3 text-slate-700 dark:text-slate-200">{actionLabel(item.action)}</td>
                              <td className="py-2.5 pr-3 text-slate-700 dark:text-slate-200">{statusLabel(item.entity)}</td>
                              <td className="whitespace-nowrap py-2.5 pr-3 text-slate-500">{formatWhen(item.created_at)}</td>
                              <td className="py-2.5"><Badge tone={result.tone}>{result.label}</Badge></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Section>
          ) : null}
        </div>
      ) : null}
    </Page>
  );
};
