import { Stack } from 'expo-router';

export default function TechnicianLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: '#0B4F6C' }, headerTintColor: '#fff' }}>
      <Stack.Screen name="home" options={{ title: 'Today' }} />
      <Stack.Screen name="my-jobs" options={{ title: 'My jobs' }} />
      <Stack.Screen name="jobs" options={{ title: 'My jobs' }} />
      <Stack.Screen name="job/[id]/index" options={{ title: 'Job' }} />
      <Stack.Screen name="job/[id]/media" options={{ title: 'Photos' }} />
      <Stack.Screen name="job/[id]/parts" options={{ title: 'Parts' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
    </Stack>
  );
}
