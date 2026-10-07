import React, { useEffect } from 'react';
import { Linking, RefreshControl, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../src/store/authStore';
import { db, watchTable } from '../../src/lib/db';
import { ScreenBody } from '../../src/components/ScreenBody';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { MetricStrip } from '../../src/components/MetricStrip';
import { RecordCard } from '../../src/components/RecordCard';
import { EmptyState } from '../../src/components/EmptyState';
import { PriorityBadge, StatusBadge } from '../../src/components/StatusBadge';
import { formatWhen, localDayBounds, mapsSearchUrl, one, todayHeading } from '../../src/lib/format';
import { useRefreshOnFocus } from '../../src/lib/focus';
import { palette, ui } from '../../src/theme';

const rank: Record<string, number> = { in_progress: 0, assigned: 1, blocked: 2, completed: 3 };

export default function TechnicianHome() {
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['tech-today', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { start, end } = localDayBounds();
      const scheduledToday = `and(scheduled_start.gte."${start}",scheduled_start.lt."${end}")`;
      const finishedToday = `and(status.eq.completed,actual_end.gte."${start}",actual_end.lt."${end}")`;
      const { data, error } = await db()
        .from('work_orders')
        .select('id, code, status, scheduled_start, actual_end, service_request:service_requests(title, priority, location_text, vessel:vessels(name), customer:customers(company_name, profile:profiles!profile_id(full_name)))')
        .eq('assigned_to', profile!.id)
        .neq('status', 'cancelled')
        .or(`${scheduledToday},status.eq.in_progress,${finishedToday}`)
        .order('scheduled_start', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).slice().sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));
    },
  });
  useRefreshOnFocus(() => { if (profile?.id) void query.refetch(); });
  useEffect(() => {
    if (!profile?.id) return;
    return watchTable('work_orders', () => queryClient.invalidateQueries({ queryKey: ['tech-today', profile.id] }), `assigned_to=eq.${profile.id}`);
  }, [profile?.id, queryClient]);

  const rows = query.data ?? [];
  const assigned = rows.filter((row) => row.status === 'assigned').length;
  const inProgress = rows.filter((row) => row.status === 'in_progress').length;
  const completed = rows.filter((row) => row.status === 'completed').length;

  return (
    <ScreenBody
      loading={query.isLoading}
      skeleton={3}
      error={query.error instanceof Error ? query.error.message : null}
      onRetry={() => query.refetch()}
    >
      <ScrollView
        contentContainerStyle={ui.pad}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={palette.primary} />}
      >
        <ScreenHeader
          eyebrow={profile?.full_name}
          title={todayHeading()}
          subtitle={rows.length === 0 ? 'No jobs scheduled for today' : rows.length === 1 ? '1 job to handle' : `${rows.length} jobs to handle`}
        />
        <MetricStrip items={[
          { label: 'Assigned', value: String(assigned) },
          { label: 'In progress', value: String(inProgress) },
          { label: 'Completed', value: String(completed) },
        ]} />
        {rows.length === 0 ? (
          <EmptyState
            icon="briefcase-outline"
            title="Nothing scheduled today"
            message="Jobs without a time today stay on the Jobs tab."
            actionLabel="View jobs"
            onAction={() => router.push('/(technician)/my-jobs')}
          />
        ) : rows.map((item) => {
          const request = one(item.service_request);
          const customer = one(request?.customer);
          const person = one(customer?.profile);
          const customerName = customer?.company_name || person?.full_name || '';
          const vessel = one(request?.vessel)?.name;
          const location = request?.location_text || '';
          const when = item.scheduled_start
            ? formatWhen(item.scheduled_start)
            : item.status === 'completed' && item.actual_end
              ? `Finished ${formatWhen(item.actual_end)}`
              : 'Unscheduled';
          return (
            <RecordCard
              key={item.id}
              title={request?.title || item.code || 'Job'}
              subtitle={[item.code, vessel].filter(Boolean).join(' · ')}
              badges={<><StatusBadge kind="job" status={item.status} /><PriorityBadge priority={request?.priority} /></>}
              lines={[
                { icon: 'account-outline', text: customerName },
                { icon: 'map-marker-outline', text: location },
                { icon: 'clock-outline', text: when },
              ]}
              actionLabel="View job"
              onPress={() => router.push(`/(technician)/job/${item.id}`)}
              secondaryIcon={location ? 'navigation-variant-outline' : undefined}
              secondaryLabel={location ? 'Open in maps' : undefined}
              onSecondary={location ? () => Linking.openURL(mapsSearchUrl(location)) : undefined}
            />
          );
        })}
      </ScrollView>
    </ScreenBody>
  );
}
