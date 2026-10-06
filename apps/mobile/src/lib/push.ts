import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getLmewSupabase } from '@lmew/supabase-client';
import { openNotification } from './notificationRoutes';

export async function registerPushToken(userId: string) {
  try {
    if (Platform.OS === 'web') return;
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
    openNotification(event.notification.request.content.data as Record<string, unknown>, role);
  });
  return () => response.remove();
}
