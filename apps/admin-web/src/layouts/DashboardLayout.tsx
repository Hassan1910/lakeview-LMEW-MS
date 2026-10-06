import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { MODULES, NAV_SECTIONS, navModules } from '../auth/access';
import { db } from '../lib/supabase';

export const DashboardLayout: React.FC = () => {
  const { profile, role, signOut, loading, can, canAny } = useAuth();
  const lowStock = useQuery({
    queryKey: ['low-stock-count'],
    enabled: can('inventory.view'),
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await db().from('inventory_items').select('quantity_on_hand, reorder_level').eq('is_active', true);
      if (error) throw error;
      return (data ?? []).filter((item) => Number(item.quantity_on_hand) <= Number(item.reorder_level)).length;
    },
  });
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [dark, setDark] = useState(document.documentElement.classList.contains('dark'));
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const toggleDark = () => {
    document.documentElement.classList.toggle('dark');
    setDark(document.documentElement.classList.contains('dark'));
  };

  if (loading) return <p className="p-6">Loading…</p>;
  if (!profile) return null;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside className={`${open ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 z-20 w-64 overflow-y-auto bg-[#0B4F6C] p-4 text-white transition lg:static lg:translate-x-0`}>
        <p className="mb-4 font-semibold">Lakeview Marine</p>
        <nav aria-label="Main">
          {NAV_SECTIONS.map((section) => {
            const items = navModules(can).filter((item) => item.section === section);
            if (items.length === 0) return null;
            return (
              <div key={section} className="mb-3">
                <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-white/60">{section}</p>
                {items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={MODULES.some((other) => other !== item && other.path.startsWith(`${item.path}/`))}
                    className={({ isActive }) => `flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-white/10 ${isActive ? 'bg-white/15 font-medium' : ''}`}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                    {item.path === '/inventory' && lowStock.data ? (
                      <span className="rounded-full bg-amber-400 px-2 text-xs font-semibold text-slate-900" title="Items at or below reorder level">{lowStock.data}</span>
                    ) : null}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>
      {open ? <button aria-label="Close menu" className="fixed inset-0 z-10 bg-black/30 lg:hidden" onClick={() => setOpen(false)} /> : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-white px-4 py-3 dark:bg-slate-900">
          <button className="lg:hidden" onClick={() => setOpen((value) => !value)}>Menu</button>
          {canAny(['customers.view', 'vessels.view', 'service_requests.view']) ? (
            <form onSubmit={(event) => { event.preventDefault(); navigate(`/search?q=${encodeURIComponent(query)}`); }}>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customers, vessels, requests" className="rounded border px-2 py-1" />
            </form>
          ) : null}
          <Link to="/profile" className="ml-auto text-sm hover:underline">{profile.full_name} · {role?.name ?? profile.role}</Link>
          <button onClick={toggleDark}>{dark ? 'Light' : 'Dark'}</button>
          <button onClick={() => setHelp(true)}>Help</button>
          <button onClick={() => signOut()}>Sign out</button>
        </header>
        <main className="p-4"><Outlet /></main>
      </div>
      {help ? (
        <div className="fixed inset-y-0 right-0 z-30 w-80 bg-white p-4 shadow dark:bg-slate-900">
          <button onClick={() => setHelp(false)}>Close</button>
          <h2 className="mt-4 font-semibold">Help</h2>
          {[
            ['How does a job move?', 'Receive the request, assign a technician, send a quotation, and issue an invoice after the customer accepts.'],
            ['Who can confirm payment?', 'Finance verifies cash, bank, cheque, and M-Pesa receipts. Paystack confirmation arrives from the webhook.'],
            ['Where is the team view?', 'Supervisors use Team to see technicians and the jobs assigned under them.'],
          ].map(([question, answer]) => (
            <details key={question} className="mt-3 text-sm">
              <summary className="cursor-pointer font-medium">{question}</summary>
              <p className="mt-1 text-slate-600 dark:text-slate-300">{answer}</p>
            </details>
          ))}
        </div>
      ) : null}
    </div>
  );
};
