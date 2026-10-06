import React from 'react';
import { View } from 'react-native';
import { Text as PaperText } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../src/lib/db';
import { ScreenBody } from '../../src/components/ScreenBody';

export default function SupervisorReports() {
  const query = useQuery({
    queryKey: ['tech-performance'],
    queryFn: async () => {
      const { data, error } = await db().from('work_orders').select('assigned_to, status, technician:profiles!work_orders_assigned_to_fkey(full_name)');
      if (error) throw error;
      const counts = new Map<string, { name: string; completed: number; open: number }>();
      for (const row of data ?? []) {
        const technician = Array.isArray(row.technician) ? row.technician[0] : row.technician;
        const name = technician?.full_name ?? row.assigned_to;
        const current = counts.get(row.assigned_to) ?? { name, completed: 0, open: 0 };
        if (row.status === 'completed') current.completed += 1;
        else current.open += 1;
        counts.set(row.assigned_to, current);
      }
      return [...counts.values()];
    },
  });
  return (
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!query.data?.length} emptyLabel="No performance data.">
      {(query.data ?? []).map((row) => {
        const total = row.completed + row.open || 1;
        return (
          <View key={row.name} style={{ marginBottom: 12 }}>
            <PaperText>{row.name}: {row.completed} completed, {row.open} open</PaperText>
            <View style={{ height: 10, backgroundColor: '#E2E8F0', borderRadius: 6 }}>
              <View style={{ width: `${Math.round((row.completed / total) * 100)}%`, height: 10, backgroundColor: '#0B4F6C', borderRadius: 6 }} />
            </View>
          </View>
        );
      })}
    </ScreenBody>
  );
}
