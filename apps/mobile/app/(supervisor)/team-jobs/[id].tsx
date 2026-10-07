import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../../../src/lib/db';
import { ScreenBody } from '../../../src/components/ScreenBody';
import { FieldLine, Notice, Page } from '../../../src/components/ui';
import { friendlyError, labelize, one } from '../../../src/lib/format';
import { ui } from '../../../src/theme';

type Person = { id: string; full_name: string | null };

export default function TeamJobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');
  const [assignee, setAssignee] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const query = useQuery({
    queryKey: ['team-job', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error: queryError } = await db()
        .from('work_orders')
        .select('*, service_request:service_requests(title, status, code), technician:profiles!work_orders_assigned_to_fkey(full_name, phone)')
        .eq('id', id)
        .single();
      if (queryError) throw queryError;
      return data;
    },
  });
  const technicians = useQuery({
    queryKey: ['assignable-technicians'],
    queryFn: async () => {
      const { data, error: queryError } = await db().rpc('assignable_profiles', { p_permission: 'work_orders.execute' });
      if (queryError) throw queryError;
      return (data ?? []) as Person[];
    },
  });

  useEffect(() => {
    if (hydrated || !query.data) return;
    setNotes(query.data.notes ?? '');
    setAssignee(query.data.assigned_to ?? '');
    setHydrated(true);
  }, [hydrated, query.data]);

  const save = async () => {
    if (!assignee) return setError('Choose a technician.');
    setSaving(true);
    setError(null);
    const { error: updateError } = await db().from('work_orders').update({
      assigned_to: assignee,
      notes: notes.trim() || null,
    }).eq('id', id);
    setSaving(false);
    if (updateError) return setError(friendlyError(updateError.message));
    setSuccess('Job updated.');
    queryClient.invalidateQueries({ queryKey: ['team-job', id] });
    queryClient.invalidateQueries({ queryKey: ['team-jobs'] });
  };

  const job = query.data;
  const request = one(job?.service_request);
  const technician = one(job?.technician);
  const choices = technicians.data ?? [];
  const known = choices.some((person) => person.id === assignee);

  return (
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} onRetry={() => query.refetch()}>
      <Page>
        <Text style={ui.title}>{job?.code ?? 'Job'}</Text>
        <FieldLine label="Request" value={[request?.code, request?.title].filter(Boolean).join(' · ')} />
        <FieldLine label="Request status" value={request?.status ? labelize(request.status) : null} />
        <FieldLine label="Work order" value={job?.status ? labelize(job.status) : null} />
        <FieldLine label="Current technician" value={technician?.full_name ?? 'Unassigned'} />
        <FieldLine label="Phone" value={technician?.phone} />
        <FieldLine label="Scheduled" value={job?.scheduled_start} />
        {error ? <Notice tone="error" text={error} /> : null}
        {success ? <Notice tone="ok" text={success} /> : null}
        <Text style={ui.section}>Reassign</Text>
        <View style={ui.row}>
          {!known && assignee ? <Button mode={assignee === job?.assigned_to ? 'contained' : 'outlined'} onPress={() => setAssignee(job?.assigned_to ?? assignee)}>{technician?.full_name ?? 'Current'}</Button> : null}
          {choices.map((person) => (
            <Button key={person.id} mode={assignee === person.id ? 'contained' : 'outlined'} onPress={() => setAssignee(person.id)}>
              {person.full_name ?? 'Technician'}
            </Button>
          ))}
        </View>
        <TextInput label="Notes" value={notes} onChangeText={setNotes} mode="outlined" multiline />
        <Button mode="contained" loading={saving} disabled={saving} onPress={save}>Save assignment</Button>
      </Page>
    </ScreenBody>
  );
}
