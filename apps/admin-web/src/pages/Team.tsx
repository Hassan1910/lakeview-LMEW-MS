import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';

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
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Team jobs</h1>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={mine} onChange={(e) => setScope(e.target.checked ? 'mine' : 'all')} /> Only jobs I supervise
        </label>
      </div>
      <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!groups.length} emptyLabel={mine ? 'You are not supervising any jobs.' : 'No team jobs yet.'}>
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.name} className="rounded bg-white p-4 dark:bg-slate-900">
              <h2 className="font-semibold">{group.name}</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {group.jobs.map((job) => (
                  <li key={job.id}><Link className="text-[#0B4F6C]" to={`/work-orders/${job.id}`}>{job.code ?? job.id}</Link> · {job.status}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DataState>
    </div>
  );
};
