import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { Card, Page, StatusBadge, linkClass } from '../components/ui';

type Job = { id: string; code: string | null; status: string };

export const Team: React.FC = () => {
  const { profile } = useAuth();
  const [scope, setScope] = useState<'auto' | 'mine' | 'all'>('auto');
  const query = useQuery({
    queryKey: ['team', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await db().from('work_orders').select('id, code, status, supervisor_id, technician:profiles!work_orders_assigned_to_fkey(id, full_name)').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const supervisesAny = (query.data ?? []).some((row) => row.supervisor_id === profile?.id);
  const mine = scope === 'mine' || (scope === 'auto' && supervisesAny);

  const groups = useMemo(() => {
    const byTechnician = new Map<string, { name: string; jobs: Job[] }>();
    for (const row of query.data ?? []) {
      if (mine && row.supervisor_id !== profile?.id) continue;
      const technician = Array.isArray(row.technician) ? row.technician[0] : row.technician;
      const key = technician?.id ?? 'unassigned';
      const current = byTechnician.get(key) ?? { name: technician?.full_name ?? 'Unassigned', jobs: [] as Job[] };
      current.jobs.push({ id: row.id, code: row.code, status: row.status });
      byTechnician.set(key, current);
    }
    return [...byTechnician.values()];
  }, [query.data, mine, profile?.id]);

  return (
    <Page
      title="Team"
      description="Work grouped by the technician assigned to it."
      actions={(
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={mine} onChange={(event) => setScope(event.target.checked ? 'mine' : 'all')} />
          Only jobs I supervise
        </label>
      )}
    >
      <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!groups.length} emptyLabel={mine ? 'You are not supervising any jobs.' : 'No team jobs yet.'}>
        <div className="grid gap-3 lg:grid-cols-2">
          {groups.map((group) => (
            <Card key={group.name} title={`${group.name} · ${group.jobs.length}`}>
              <ul className="space-y-2 text-sm">
                {group.jobs.map((job) => (
                  <li key={job.id} className="flex items-center justify-between gap-3">
                    <Link className={linkClass} to={`/work-orders/${job.id}`}>{job.code ?? 'Work order'}</Link>
                    <StatusBadge status={job.status} />
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </DataState>
    </Page>
  );
};
