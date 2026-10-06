import { router } from 'expo-router';
import { routeForNotification } from './routes';

export { routeForNotification };

export function openNotification(data: Record<string, unknown> | null | undefined, role: string | null) {
  const href = routeForNotification(data, role);
  if (href) router.push(href as never);
}
