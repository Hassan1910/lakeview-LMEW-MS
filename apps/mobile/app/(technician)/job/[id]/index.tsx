import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { Link, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db, watchTable } from '../../../../src/lib/db';
import { ScreenBody } from '../../../../src/components/ScreenBody';

const statuses = ['assigned', 'in_progress', 'blocked', 'completed'] as const;

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['job', id],
    queryFn: async () => {
      const { data, error: queryError } = await db().from('work_orders').select('*, service_request:service_requests(title, description, location_text, customer:customers(company_name, profile:profiles(full_name, phone)), vessel:vessels(name, registration_no, engine_details))').eq('id', id).single();
      if (queryError) throw queryError;
      return data;
    },
  });

  useEffect(() => watchTable('work_orders', () => queryClient.invalidateQueries({ queryKey: ['job', id] }), `id=eq.${id}`), [id, queryClient]);

  const updateStatus = async (status: (typeof statuses)[number]) => {
    const patch: Record<string, string | null> = { status, notes: notes || query.data?.notes };
    if (status === 'in_progress') patch.actual_start = new Date().toISOString();
    if (status === 'completed') patch.actual_end = new Date().toISOString();
    const { error: updateError } = await db().from('work_orders').update(patch).eq('id', id);
    if (updateError) setError(updateError.message);
    else { setSuccess(`Status is now ${status}`); setError(null); queryClient.invalidateQueries({ queryKey: ['job', id] }); }
  };

  const job = query.data;
  return (
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null}>
      <ScrollView contentContainerStyle={styles.pad}>
        <Text variant="titleLarge">{job?.code}</Text>
        <Text>{job?.service_request?.title}</Text>
        <Text>{job?.service_request?.description}</Text>
        <Text>Customer: {job?.service_request?.customer?.profile?.full_name ?? job?.service_request?.customer?.company_name}</Text>
        <Text>Phone: {job?.service_request?.customer?.profile?.phone ?? 'Not on file'}</Text>
        <Text>Scheduled: {job?.scheduled_start ?? 'Not scheduled'}</Text>
        <Text>Vessel: {job?.service_request?.vessel?.name} {job?.service_request?.vessel?.registration_no}</Text>
        <Text>Engine: {job?.service_request?.vessel?.engine_details}</Text>
        <Text>Location: {job?.service_request?.location_text}</Text>
        <TextInput label="Notes" value={notes} onChangeText={setNotes} mode="outlined" />
        {statuses.map((status) => <Button key={status} mode={job?.status === status ? 'contained' : 'outlined'} onPress={() => updateStatus(status)}>{status}</Button>)}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.ok}>{success}</Text> : null}
        <Link href={`/(technician)/job/${id}/media`}>Upload photos</Link>
        <Link href={`/(technician)/job/${id}/parts`}>Request parts</Link>
      </ScrollView>
    </ScreenBody>
  );
}

const styles = StyleSheet.create({ pad: { padding: 16, gap: 8 }, error: { color: '#EF4444' }, ok: { color: '#22C55E' } });
