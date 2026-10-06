import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { UserRole } from '@lmew/shared-types';

export type ClientDestination = 'customer' | 'technician' | 'supervisor' | 'admin';

// Every web role, including custom ones, signs in to the single admin dashboard.
export function destinationForRole(role: UserRole | null | undefined): ClientDestination | null {
  if (!role) return null;
  if (role === 'customer') return 'customer';
  if (role === 'technician') return 'technician';
  if (role === 'supervisor') return 'supervisor';
  return 'admin';
}

export function subscribePostgresChanges(
  client: SupabaseClient,
  table: string,
  onChange: () => void,
  filter?: string,
): () => void {
  const channel: RealtimeChannel = client
    .channel(`${table}:${filter ?? 'all'}:${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
