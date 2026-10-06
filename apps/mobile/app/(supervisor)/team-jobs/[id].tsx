import React from 'react';
import { Text } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../../src/lib/db';
import { ScreenBody } from '../../../src/components/ScreenBody';

export default function TeamJobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({
    queryKey: ['team-job', id],
    queryFn: async () => {
      const { data, error } = await db().from('work_orders').select('*, service_request:service_requests(title, status)').eq('id', id).single();
      if (error) throw error;
      return data;
    },
  });
  return (
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null}>
      <Text variant="titleLarge">{query.data?.code}</Text>
      <Text>{query.data?.service_request?.title}</Text>
      <Text>Work order {query.data?.status}</Text>
      <Text>Request {query.data?.service_request?.status}</Text>
      <Text>{query.data?.notes}</Text>
    </ScreenBody>
  );
}
