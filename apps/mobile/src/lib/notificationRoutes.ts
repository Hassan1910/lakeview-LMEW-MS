import { router } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { db } from './db';
import { routeForNotification, technicianRequestFallback } from './routes';

export { routeForNotification };

export async function openNotification(data: Record<string, unknown> | null | undefined, role: string | null) {
  const href = routeForNotification(data, role);
  if (href) {
    router.push(href as never);
    return;
  }
  const requestId = technicianRequestFallback(data, role);
  if (!requestId) return;
  const userId = useAuthStore.getState().profile?.id;
  if (!userId) return;
  const { data: job, error } = await db()
    .from('work_orders')
    .select('id')
    .eq('service_request_id', requestId)
    .eq('assigned_to', userId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !job?.id) return;
  router.push(`/(technician)/job/${job.id}` as never);
}
