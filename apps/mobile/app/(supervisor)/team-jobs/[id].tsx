import React from 'react';
import { Text } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../../src/lib/db';
import { ScreenBody } from '../../../src/components/ScreenBody';
import { FieldLine, Page } from '../../../src/components/ui';
import { labelize, one } from '../../../src/lib/format';
import { ui } from '../../../src/theme';

export default function TeamJobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({
    queryKey: ['team-job', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await db()
        .from('work_orders')
        .select('*, service_request:service_requests(title, status, code), technician:profiles!work_orders_assigned_to_fkey(full_name, phone)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const job = query.data;
  const request = one(job?.service_request);
  const technician = one(job?.technician);
  return (
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} onRetry={() => query.refetch()}>
      <Page>
        <Text style={ui.title}>{job?.code ?? 'Job'}</Text>
        <FieldLine label="Request" value={[request?.code, request?.title].filter(Boolean).join(' · ')} />
        <FieldLine label="Request status" value={request?.status ? labelize(request.status) : null} />
        <FieldLine label="Work order" value={job?.status ? labelize(job.status) : null} />
        <FieldLine label="Technician" value={technician?.full_name ?? 'Unassigned'} />
        <FieldLine label="Phone" value={technician?.phone} />
        <FieldLine label="Scheduled" value={job?.scheduled_start} />
        <FieldLine label="Notes" value={job?.notes} />
      </Page>
    </ScreenBody>
  );
}
