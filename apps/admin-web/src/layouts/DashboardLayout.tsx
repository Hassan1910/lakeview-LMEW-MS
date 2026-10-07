import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FilePlus,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,
  Receipt,
  ScrollText,
  Search,
  Settings,
  Shield,
  Ship,
  ShoppingCart,
  Sun,
  Truck,
  UserPlus,
  UserRound,
  Users,
  Wallet,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { BrandMark } from '../components/BrandMark';
import { MODULES, NAV_SECTIONS, navModules } from '../auth/access';
import { db } from '../lib/supabase';
import { useLowStockCount } from '../lib/lowStock';

const ICONS: Record<string, LucideIcon> = {
  '/dashboard': LayoutDashboard,
  '/notifications': Bell,
  '/reception': UserPlus,
  '/requests/new': FilePlus,
  '/appointments': CalendarDays,
  '/team': Users,
  '/service-requests': ClipboardList,
  '/work-orders': Wrench,
  '/quotations': FileText,
  '/customers': Users,
  '/vessels': Ship,
  '/feedback': MessageSquare,
  '/invoices': Receipt,
  '/payments': Wallet,
  '/reports': PieChart,
  '/inventory': Package,
  '/inventory/report': PieChart,
  '/stock-movements': ArrowLeftRight,
  '/suppliers': Truck,
  '/purchase-orders': ShoppingCart,
  '/my-orders': ClipboardList,
  '/users': Users,
  '/roles': Shield,
  '/company': Building2,
  '/audit': ScrollText,
  '/settings': Settings,
};

const SIDEBAR_KEY = 'lmew-admin-sidebar';

export const DashboardLayout: React.FC = () => {
  const { profile, role, signOut, loading, can, canAny } = useAuth();
  const lowStock = useLowStockCount(can('inventory.view'));
  const unread = useQuery({
    queryKey: ['unread-notifications', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { count, error } = await db().from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', profile!.id).is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [menu, setMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1');
  const [dark, setDark] = useState(document.documentElement.classList.contains('dark'));
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const showSearch = canAny(['customers.view', 'vessels.view', 'service_requests.view']);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  const toggleDark = () => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('lmew-theme', next ? 'dark' : 'light');
    setDark(next);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-lmew-blue-900 text-sm text-sky-100" role="status">
        <BrandMark className="h-16 w-16" />
        Loading your workspace…
      </div>
    );
  }
  if (!profile) return null;

  const sections = NAV_SECTIONS.map((section) => ({
    section,
    items: navModules(can).filter((item) => item.section === section),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside className={`${open ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 z-30 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900 lg:static lg:translate-x-0 ${collapsed ? 'lg:w-16' : 'lg:w-60'}`}>
        <div className={`flex h-14 items-center gap-2 border-b border-slate-200 px-3 dark:border-slate-800 ${collapsed ? 'lg:justify-center' : ''}`}>
          <BrandMark className="h-8 w-8 shrink-0" decorative />
          <div className={collapsed ? 'lg:hidden' : ''}>
            <p className="text-sm font-semibold leading-tight">Lakeview Marine</p>
            <p className="text-xs text-slate-500">Operations</p>
          </div>
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto px-2 py-3">
          {sections.map((group) => (
            <div key={group.section} className="mb-3">
              <p className={`px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 ${collapsed ? 'lg:sr-only' : ''}`}>{group.section}</p>
              {group.items.map((item) => {
                const Icon = ICONS[item.path] ?? LayoutDashboard;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={item.label}
                    end={MODULES.some((other) => other !== item && other.path.startsWith(`${item.path}/`))}
                    className={({ isActive }) => `mb-0.5 flex items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 ${collapsed ? 'lg:justify-center' : ''} ${isActive ? 'bg-lmew-blue-800/10 font-medium text-lmew-blue-800 shadow-[inset_2px_0_0_#0B4F6C] dark:text-sky-200' : ''}`}
                    onClick={() => setOpen(false)}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className={`truncate ${collapsed ? 'lg:sr-only' : ''}`}>{item.label}</span>
                    {item.path === '/inventory' && lowStock.data ? (
                      <span className={`ml-auto rounded-md bg-amber-100 px-1.5 text-xs font-medium text-amber-800 ${collapsed ? 'lg:hidden' : ''}`} title="Items at or below reorder level">{lowStock.data}</span>
                    ) : null}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
      {open ? <button aria-label="Close menu" className="fixed inset-0 z-20 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} /> : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900">
          <button className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Menu className="h-4 w-4" />
          </button>
          <button className="hidden h-9 w-9 items-center justify-center rounded-md hover:bg-slate-100 lg:inline-flex dark:hover:bg-slate-800" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed((value) => !value)}>
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          {showSearch ? (
            <form className="hidden min-w-0 flex-1 sm:block" onSubmit={(event) => { event.preventDefault(); navigate(`/search?q=${encodeURIComponent(query)}`); }}>
              <label className="relative block max-w-md">
                <span className="sr-only">Search customers, vessels, and requests</span>
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customers, vessels, requests" className="h-9 w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 text-sm outline-hidden focus:border-lmew-blue-800 focus:ring-2 focus:ring-[#0B4F6C]/20 dark:border-slate-700 dark:bg-slate-950" />
              </label>
            </form>
          ) : <span className="flex-1" />}
          <Link to="/notifications" className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={unread.data ? `${unread.data} unread notifications` : 'Notifications'}>
            <Bell className="h-4 w-4" />
            {unread.data ? <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-lmew-blue-800 px-1 text-[10px] font-medium text-white">{unread.data > 9 ? '9+' : unread.data}</span> : null}
          </Link>
          <button className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Help" onClick={() => setHelp(true)}>
            <HelpCircle className="h-4 w-4" />
          </button>
          <div className="relative">
            <button className="inline-flex h-9 max-w-48 items-center gap-2 rounded-md px-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800" aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu((value) => !value)}>
              <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{profile.full_name}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            </button>
            {menu ? (
              <>
                <button className="fixed inset-0 z-10 cursor-default" aria-label="Close account menu" onClick={() => setMenu(false)} />
                <div role="menu" className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  <p className="px-2 py-2 text-xs text-slate-500">{role?.name ?? profile.role}</p>
                  <Link role="menuitem" to="/profile" className="block rounded-md px-2 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setMenu(false)}>Profile</Link>
                  <button role="menuitem" className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800" onClick={toggleDark}>
                    {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    {dark ? 'Light theme' : 'Dark theme'}
                  </button>
                  <button role="menuitem" className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950" onClick={() => signOut()}>
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6"><Outlet /></main>
      </div>
      {help ? (
        <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="help-title">
          <button className="absolute inset-0 bg-slate-900/40" aria-label="Close help" onClick={() => setHelp(false)} />
          <aside className="relative h-full w-full max-w-sm overflow-y-auto border-l border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 id="help-title" className="text-base font-semibold">Help</h2>
              <button className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close help" onClick={() => setHelp(false)}><X className="h-4 w-4" /></button>
            </div>
            {[
              ['How does a job move?', 'Receive the request, assign a technician, send a quotation, and issue an invoice after the customer accepts.'],
              ['Who can confirm payment?', 'Finance verifies cash, bank, cheque, and M-Pesa receipts. Paystack confirmation arrives from the webhook.'],
              ['Where is the team view?', 'Supervisors use Team to see technicians and the jobs assigned under them.'],
            ].map(([question, answer]) => (
              <details key={question} className="mt-4 text-sm">
                <summary className="cursor-pointer font-medium">{question}</summary>
                <p className="mt-1 text-slate-600 dark:text-slate-300">{answer}</p>
              </details>
            ))}
          </aside>
        </div>
      ) : null}
    </div>
  );
};
