import React from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../src/lib/db';
import { ScreenBody } from '../../src/components/ScreenBody';
import { one } from '../../src/lib/format';
import { palette, ui } from '../../src/theme';

export default function SupervisorReports() {
  const query = useQuery({
    queryKey: ['tech-performance'],
    queryFn: async () => {
      const { data, error } = await db().from('work_orders').select('assigned_to, status, technician:profiles!work_orders_assigned_to_fkey(full_name)');
      if (error) throw error;
      const counts = new Map<string, { name: string; completed: number; open: number }>();
      for (const row of data ?? []) {
        const technician = one(row.technician);
        const key = row.assigned_to ?? 'unassigned';
        const current = counts.get(key) ?? { name: technician?.full_name ?? 'Unassigned', completed: 0, open: 0 };
        if (row.status === 'completed') current.completed += 1;
        else if (row.status !== 'cancelled') current.open += 1;
        counts.set(key, current);
      }
      return [...counts.values()];
    },
  });
  return (
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!query.data?.length} emptyLabel="No performance data yet." onRetry={() => query.refetch()}>
      <ScrollView contentContainerStyle={ui.pad}>
        <Text style={ui.muted}>Completed jobs against everything still open. Cancelled jobs are left out.</Text>
        {(query.data ?? []).map((row) => {
          const total = row.completed + row.open || 1;
          const width = `${Math.round((row.completed / total) * 100)}%` as const;
          return (
            <View key={row.name} style={ui.card}>
              <Text style={ui.body}>{row.name}</Text>
              <Text style={ui.muted}>{row.completed} completed · {row.open} open</Text>
              <View style={{ height: 8, backgroundColor: palette.border, borderRadius: 99 }}>
                <View style={{ width, height: 8, backgroundColor: palette.primary, borderRadius: 99 }} />
              </View>
            </View>
          );
        })}
      </ScrollView>
    </ScreenBody>
  );
}
