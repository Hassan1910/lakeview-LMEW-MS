import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../../src/lib/db';
import { ScreenBody } from '../../../src/components/ScreenBody';
import { FieldLine, Page } from '../../../src/components/ui';
import { labelize } from '../../../src/lib/format';
import { ui } from '../../../src/theme';

export default function VesselDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({
    queryKey: ['vessel', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await db().from('vessels').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
  });
  const vessel = query.data;
  return (
    <ScreenBody loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} onRetry={() => query.refetch()}>
      <Page>
        <Text style={ui.title}>{vessel?.name}</Text>
        <FieldLine label="Registration" value={vessel?.registration_no} />
        <FieldLine label="Type" value={vessel?.type ? labelize(vessel.type) : null} />
        <FieldLine label="Engine" value={vessel?.engine_details} />
        <FieldLine label="Length" value={vessel?.length_m ? `${vessel.length_m} m` : null} />
        <FieldLine label="Year built" value={vessel?.year_built ? String(vessel.year_built) : null} />
        {!vessel?.registration_no && !vessel?.type && !vessel?.engine_details ? <Text style={ui.muted}>No extra details have been added yet.</Text> : null}
      </Page>
    </ScreenBody>
  );
}
