import React, { useEffect, useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { Link, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db, watchTable } from '../../../../src/lib/db';
import { ScreenBody } from '../../../../src/components/ScreenBody';
import { Choice, FieldLine, Notice } from '../../../../src/components/ui';
import { formatWhen, friendlyError, labelize, mapsSearchUrl, one } from '../../../../src/lib/format';
import { PriorityBadge, StatusBadge } from '../../../../src/components/StatusBadge';
import { ui } from '../../../../src/theme';

const statuses = ['assigned', 'in_progress', 'blocked', 'completed'] as const;

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const query = useQuery({
    queryKey: ['job', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error: queryError } = await db().from('work_orders').select('*, service_request:service_requests(title, description, priority, location_text, customer:customers(company_name, profile:profiles!profile_id(full_name, phone)), vessel:vessels(name, registration_no, engine_details))').eq('id', id).single();
      if (queryError) throw queryError;
      return data;
    },
  });

  useEffect(() => {
    if (!id) return;
    return watchTable('work_orders', () => queryClient.invalidateQueries({ queryKey: ['job', id] }), `id=eq.${id}`);
  }, [id, queryClient]);

  useEffect(() => {
    if (hydrated || !query.data) return;
    setNotes(query.data.notes ?? '');
    setHydrated(true);
  }, [hydrated, query.data]);

  const updateStatus = async (status: (typeof statuses)[number]) => {
    if (saving) return;
    setSaving(true);
    const patch: Record<string, string | null> = { status, notes: notes.trim() || null };
    if (status === 'in_progress' && !query.data?.actual_start) patch.actual_start = new Date().toISOString();
    if (status === 'completed') patch.actual_end = new Date().toISOString();
    const { error: updateError } = await db().from('work_orders').update(patch).eq('id', id);
    setSaving(false);
    if (updateError) setError(friendlyError(updateError.message));
    else {
      setSuccess(`Status is now ${labelize(status)}`);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['job', id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['tech-count'] });
      queryClient.invalidateQueries({ queryKey: ['tech-today'] });
    }
  };

  const job = query.data;
  const request = one(job?.service_request);
  const customer = one(request?.customer);
  const profile = one(customer?.profile);
  const vessel = one(request?.vessel);
  const phone = profile?.phone;

  return (
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} onRetry={() => query.refetch()}>
      <ScrollView contentContainerStyle={ui.pad}>
        <Text style={ui.title}>{job?.code ?? 'Job'}</Text>
        <Text style={ui.body}>{request?.title}</Text>
        <View style={ui.row}>
          <StatusBadge kind="job" status={job?.status} />
          <PriorityBadge priority={request?.priority} />
        </View>
        {request?.description ? <Text style={ui.muted}>{request.description}</Text> : null}
        <FieldLine label="Customer" value={profile?.full_name ?? customer?.company_name} />
        <FieldLine label="Phone" value={phone ?? 'Not on file'} />
        {phone ? <Button mode="outlined" icon="phone" onPress={() => Linking.openURL(`tel:${phone}`)}>Call customer</Button> : null}
        <FieldLine label="Scheduled" value={job?.scheduled_start ? formatWhen(job.scheduled_start) : 'Not scheduled'} />
        <FieldLine label="Vessel" value={[vessel?.name, vessel?.registration_no].filter(Boolean).join(' · ')} />
        <FieldLine label="Engine" value={vessel?.engine_details} />
        <FieldLine label="Location" value={request?.location_text} />
        {request?.location_text ? <Button mode="outlined" icon="map-marker" onPress={() => Linking.openURL(mapsSearchUrl(request.location_text))}>Open in maps</Button> : null}
        <Text style={ui.section}>Update status</Text>
        <View style={ui.row}>
          {statuses.map((status) => (
            <Choice key={status} label={labelize(status)} selected={job?.status === status} onPress={() => updateStatus(status)} />
          ))}
        </View>
        <TextInput label="Notes" value={notes} onChangeText={setNotes} mode="outlined" multiline />
        <Button mode="outlined" disabled={saving} onPress={async () => {
          setSaving(true);
          const { error: updateError } = await db().from('work_orders').update({ notes: notes.trim() || null }).eq('id', id);
          setSaving(false);
          if (updateError) setError(friendlyError(updateError.message));
          else { setSuccess('Notes saved'); setError(null); queryClient.invalidateQueries({ queryKey: ['job', id] }); }
        }}>Save notes</Button>
        {error ? <Notice tone="error" text={error} /> : null}
        {success ? <Notice tone="ok" text={success} /> : null}
        <Link href={`/(technician)/job/${id}/media`} asChild><Button mode="contained">Upload photos</Button></Link>
        <Link href={`/(technician)/job/${id}/parts`} asChild><Button mode="outlined">Request parts</Button></Link>
      </ScrollView>
    </ScreenBody>
  );
}
