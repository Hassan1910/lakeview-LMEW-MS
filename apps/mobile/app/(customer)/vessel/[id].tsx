import React from 'react';
import { Text } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../../src/lib/db';
import { ScreenBody } from '../../../src/components/ScreenBody';

export default function VesselDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({
    queryKey: ['vessel', id],
    queryFn: async () => {
      const { data, error } = await db().from('vessels').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
  });
  const vessel = query.data;
  return (
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null}>
      <Text variant="titleLarge">{vessel?.name}</Text>
      <Text>{vessel?.registration_no}</Text>
      <Text>{vessel?.type}</Text>
      <Text>{vessel?.engine_details}</Text>
      <Text>{vessel?.length_m ? `${vessel.length_m} m` : ''}</Text>
    </ScreenBody>
  );
}
