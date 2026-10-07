import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { getLmewSupabase } from '@lmew/supabase-client';
import { openNotification } from './notificationRoutes';

type NotificationsModule = typeof import('expo-notifications');

function androidExpoGo() {
  return Platform.OS === 'android' && isRunningInExpoGo();
}

async function loadNotifications(): Promise<NotificationsModule | null> {
  if (androidExpoGo()) return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

export async function registerPushToken(userId: string) {
  try {
    if (Platform.OS === 'web') return;
    const Notifications = await loadNotifications();
    if (!Notifications) return;
    const current = await Notifications.getPermissionsAsync() as { granted?: boolean; status?: string };
    const requested = current.granted || current.status === 'granted'
      ? current
      : await Notifications.requestPermissionsAsync() as { granted?: boolean; status?: string };
    const granted = requested.granted === true || requested.status === 'granted';
    if (!granted) return;
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await getLmewSupabase().from('profiles').update({ expo_push_token: token }).eq('id', userId);
  } catch {
    // Simulators and missing Expo project ids cannot register a push token.
  }
}

export function listenForNotificationTaps(role: string | null) {
  if (androidExpoGo()) return () => {};

  let remove = () => {};
  let cancelled = false;
  void loadNotifications().then((Notifications) => {
    if (!Notifications || cancelled) return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    const response = Notifications.addNotificationResponseReceivedListener((event) => {
      void openNotification(event.notification.request.content.data as Record<string, unknown>, role);
    });
    remove = () => response.remove();
  });
  return () => {
    cancelled = true;
    remove();
  };
}
