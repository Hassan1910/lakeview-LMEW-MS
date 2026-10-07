import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import { DataState } from '../components/DataState';
import { Badge, Button, Page, Table, errorMessage, inputClass } from '../components/ui';
import { downloadCsv } from '../lib/csv';
import { useAuth } from '../auth/AuthProvider';

const PAGE_SIZE = 50;
const ENTITY_GROUPS: { label: string; entities: string[] }[] = [
  { label: 'Access control', entities: ['accounts', 'profiles', 'roles', 'role_permissions'] },
  { label: 'Service', entities: ['service_requests', 'work_orders', 'quotations', 'customers', 'appointments'] },
  { label: 'Finance', entities: ['invoices', 'payments'] },
  { label: 'Inventory & procurement', entities: ['inventory_items', 'stock_movements', 'suppliers', 'purchase_orders'] },
  { label: 'Company', entities: ['company_info'] },
];
const ACCESS = new Set(ENTITY_GROUPS[0].entities);

interface AuditRow {
  id: number;
  created_at: string;
  action: string;
  entity: string;
  entity_id: string | null;
  actor_email: string | null;
  changed_fields: string[] | null;
  before: unknown;
  after: unknown;
}

const actionTone = (action: string) => {
  if (/DELETE|REMOVED|SUSPENDED/.test(action)) return 'red' as const;
  if (/INSERT|CREATED|INVITED|RESTORED/.test(action)) return 'green' as const;
  if (/PASSWORD/.test(action)) return 'amber' as const;
  return 'blue' as const;
};

function summary(row: AuditRow) {
  const record = (row.after ?? row.before) as Record<string, unknown> | null;
  if (!record) return null;
  if (row.entity === 'role_permissions') return String(record.permission_key ?? '');
  const label = record.full_name ?? record.name ?? record.code ?? record.title ?? record.email ?? record.key;
  return label ? String(label) : null;
}

export const Audit: React.FC = () => {
  const { can } = useAuth();
  const [entity, setEntity] = useState('access');
  const [action, setAction] = useState('');
  const [actor, setActor] = useState('');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<number | null>(null);

  const query = useQuery({
    queryKey: ['audit', entity, action, actor, page],
    queryFn: async () => {
      let request = db()
        .from('audit_logs')
        .select('id, created_at, action, entity, entity_id, actor_email, changed_fields, before, after', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (entity === 'access') request = request.in('entity', [...ACCESS]);
      else if (entity) request = request.eq('entity', entity);
      if (action) request = request.ilike('action', `%${action}%`);
      if (actor.trim()) request = request.ilike('actor_email', `%${actor.trim()}%`);
      const { data, error, count } = await request;
      if (error) throw error;
      return { rows: (data ?? []) as AuditRow[], count: count ?? 0 };
    },
  });

  const rows = query.data?.rows ?? [];
  const total = query.data?.count ?? 0;
  const resetPage = () => { setPage(0); setOpen(null); };

  const exportCsv = () => downloadCsv('audit-log.csv', ['when', 'actor', 'action', 'entity', 'entity_id', 'changed_fields'], rows.map((row) => [row.created_at, row.actor_email ?? 'system', row.action, row.entity, row.entity_id, (row.changed_fields ?? []).join(' ')]));

  return (
    <Page
      title="Audit log"
      description="Who changed what, including role, permission, and account changes."
      actions={can('audit.view') && rows.length ? <Button variant="secondary" onClick={exportCsv}>Export this page</Button> : null}
    >
      <div className="flex flex-wrap gap-3">
        <select aria-label="Filter by area" className={`${inputClass} w-60`} value={entity} onChange={(e) => { setEntity(e.target.value); resetPage(); }}>
          <option value="access">Access control (accounts, roles, permissions)</option>
          <option value="">Everything</option>
          {ENTITY_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.entities.map((name) => <option key={name} value={name}>{name.replace(/_/g, ' ')}</option>)}
            </optgroup>
          ))}
        </select>
        <select aria-label="Filter by action" className={`${inputClass} w-44`} value={action} onChange={(e) => { setAction(e.target.value); resetPage(); }}>
          <option value="">Any action</option>
          <option value="INSERT">Created</option>
          <option value="UPDATE">Updated</option>
          <option value="DELETE">Deleted</option>
          <option value="ACCOUNT_">Account actions</option>
          <option value="PASSWORD">Password actions</option>
        </select>
        <input aria-label="Filter by actor" className={`${inputClass} max-w-xs`} placeholder="Actor email" value={actor} onChange={(e) => { setActor(e.target.value); resetPage(); }} />
      </div>

      <DataState loading={query.isLoading} error={errorMessage(query.error)} empty={!rows.length} emptyLabel="No audit events match these filters.">
        <Table head={['When', 'Actor', 'Action', 'Record', 'Changed', '']}>
          {rows.map((row) => (
            <React.Fragment key={row.id}>
              <tr>
                <td className="px-3 py-2 whitespace-nowrap text-xs">{new Date(row.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">{row.actor_email ?? <span className="text-slate-500">system</span>}</td>
                <td className="px-3 py-2"><Badge tone={actionTone(row.action)}>{row.action}</Badge></td>
                <td className="px-3 py-2">
                  <span className="font-medium">{row.entity.replace(/_/g, ' ')}</span>
                  {summary(row) ? <span className="block text-xs text-slate-500">{summary(row)}</span> : null}
                </td>
                <td className="px-3 py-2 text-xs">{row.changed_fields?.length ? row.changed_fields.join(', ') : '—'}</td>
                <td className="px-3 py-2 text-right">
                  {row.before || row.after ? <Button variant="secondary" onClick={() => setOpen(open === row.id ? null : row.id)}>{open === row.id ? 'Hide' : 'Details'}</Button> : null}
                </td>
              </tr>
              {open === row.id ? (
                <tr>
                  <td colSpan={6} className="bg-slate-50 px-3 py-2 dark:bg-slate-950">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div><p className="mb-1 text-xs font-semibold uppercase text-slate-500">Before</p><pre className="max-h-64 overflow-auto rounded-sm bg-white p-2 text-xs dark:bg-slate-900">{row.before ? JSON.stringify(row.before, null, 2) : '—'}</pre></div>
                      <div><p className="mb-1 text-xs font-semibold uppercase text-slate-500">After</p><pre className="max-h-64 overflow-auto rounded-sm bg-white p-2 text-xs dark:bg-slate-900">{row.after ? JSON.stringify(row.after, null, 2) : '—'}</pre></div>
                    </div>
                  </td>
                </tr>
              ) : null}
            </React.Fragment>
          ))}
        </Table>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">{page * PAGE_SIZE + 1}–{Math.min(total, page * PAGE_SIZE + rows.length)} of {total}</span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page === 0} onClick={() => { setPage(page - 1); setOpen(null); }}>Newer</Button>
            <Button variant="secondary" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => { setPage(page + 1); setOpen(null); }}>Older</Button>
          </div>
        </div>
      </DataState>
    </Page>
  );
};
