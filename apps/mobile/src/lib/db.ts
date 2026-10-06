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
  if (data?.id) return data.id as string;

  const created = await db().rpc('ensure_my_customer');
  if (created.error) throw created.error;
  if (!created.data) throw new Error('Your customer profile could not be created. Sign out and try again.');
  return created.data as string;
}
