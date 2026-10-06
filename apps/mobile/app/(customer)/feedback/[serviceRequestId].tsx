import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FeedbackCreateSchema } from '@lmew/shared-types';
import { useAuthStore } from '../../../src/store/authStore';
import { db, myCustomerId } from '../../../src/lib/db';
import { ScreenBody } from '../../../src/components/ScreenBody';
import { Choice, Notice, Page } from '../../../src/components/ui';
import { friendlyError } from '../../../src/lib/format';
import { ui } from '../../../src/theme';

export default function FeedbackScreen() {
  const { serviceRequestId } = useLocalSearchParams<{ serviceRequestId: string }>();
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const request = useQuery({
    queryKey: ['feedback-request', serviceRequestId],
    enabled: Boolean(serviceRequestId),
    queryFn: async () => {
      const { data, error: queryError } = await db().from('service_requests').select('id, status, title, code').eq('id', serviceRequestId).single();
      if (queryError) throw queryError;
      const existing = await db().from('feedback').select('id, rating, comment').eq('service_request_id', serviceRequestId).limit(1);
      if (existing.error) throw existing.error;
      return { request: data, existing: existing.data?.[0] ?? null };
    },
  });

  const submit = async () => {
    if (!profile || saving || request.data?.existing) return;
    const customerId = await myCustomerId(profile.id);
    const parsed = FeedbackCreateSchema.safeParse({
      service_request_id: serviceRequestId,
      rating,
      category: 'service_quality',
      comment: comment.trim() || null,
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Invalid');
    setSaving(true);
    setError(null);
    const { error: insertError } = await db().from('feedback').insert({ ...parsed.data, customer_id: customerId });
    setSaving(false);
    if (insertError) setError(friendlyError(insertError.message));
    else {
      setSuccess('Thank you. Your rating was saved.');
      queryClient.invalidateQueries({ queryKey: ['feedback-request', serviceRequestId] });
    }
  };

  const saved = request.data?.existing;
  return (
    <ScreenBody loading={request.isLoading} error={request.error instanceof Error ? request.error.message : null} onRetry={() => request.refetch()}>
      <Page>
        <Text style={ui.title}>Feedback</Text>
        <Text style={ui.muted}>{request.data?.request.code ? `${request.data.request.code} · ` : ''}{request.data?.request.title}</Text>
        {request.data?.request.status !== 'completed' ? <Notice tone="info" text="Feedback opens once the yard marks this request completed." /> : null}
        {saved ? (
          <Notice tone="ok" text={`You rated this ${saved.rating} out of 5.`} />
        ) : request.data?.request.status === 'completed' ? (
          <>
            <Text style={ui.section}>Rating</Text>
            <View style={ui.row}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Choice key={value} label={String(value)} selected={rating === value} onPress={() => setRating(value)} />
              ))}
            </View>
            <TextInput label="Comment" value={comment} onChangeText={setComment} mode="outlined" multiline />
            {error ? <Notice tone="error" text={error} /> : null}
            {success ? <Notice tone="ok" text={success} /> : null}
            <Button mode="contained" loading={saving} disabled={saving || Boolean(success)} onPress={submit}>Submit feedback</Button>
          </>
        ) : null}
      </Page>
    </ScreenBody>
  );
}
