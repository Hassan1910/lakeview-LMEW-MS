import { getLmewSupabase, subscribePostgresChanges } from '@lmew/supabase-client';

export function db() {
  return getLmewSupabase();
}

export function watchTable(table: string, onChange: () => void, filter?: string) {
  return subscribePostgresChanges(db(), table, onChange, filter);
}

export async function myCustomerId(profileId: string) {
  const { data, error } = await db().from('customers').select('id').eq('profile_id', profileId).maybeSingle();
  if (error) throw error;
  return data?.id as string | undefined;
}
