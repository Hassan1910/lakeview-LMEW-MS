import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import { FeedbackCreateSchema } from '@lmew/shared-types';
import { useAuthStore } from '../../../src/store/authStore';
import { db, myCustomerId } from '../../../src/lib/db';

export default function FeedbackScreen() {
  const { serviceRequestId } = useLocalSearchParams<{ serviceRequestId: string }>();
  const profile = useAuthStore((s) => s.profile);
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async () => {
    if (!profile) return;
    const customerId = await myCustomerId(profile.id);
    const parsed = FeedbackCreateSchema.safeParse({
      service_request_id: serviceRequestId,
      rating: Number(rating),
      category: 'service_quality',
      comment,
    });
    if (!parsed.success || !customerId) return setError(parsed.success ? 'Customer record missing' : parsed.error.issues[0]?.message ?? 'Invalid');
    const { error: insertError } = await db().from('feedback').insert({ ...parsed.data, customer_id: customerId });
    if (insertError) setError(insertError.message);
    else setSuccess('Thank you. Your rating was saved.');
  };

  return (
    <View style={styles.pad}>
      <TextInput label="Rating 1-5" value={rating} onChangeText={setRating} mode="outlined" keyboardType="number-pad" />
      <TextInput label="Comment" value={comment} onChangeText={setComment} mode="outlined" multiline />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.ok}>{success}</Text> : null}
      <Button mode="contained" onPress={submit}>Submit feedback</Button>
    </View>
  );
}

const styles = StyleSheet.create({ pad: { padding: 16, gap: 12 }, error: { color: '#EF4444' }, ok: { color: '#22C55E' } });
