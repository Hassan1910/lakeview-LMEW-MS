import { Stack } from 'expo-router';

export default function SupervisorLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: '#0B4F6C' }, headerTintColor: '#fff' }}>
      <Stack.Screen name="home" options={{ title: 'Team' }} />
      <Stack.Screen name="overview" options={{ title: 'Team' }} />
      <Stack.Screen name="team-jobs/index" options={{ title: 'Team jobs' }} />
      <Stack.Screen name="team-jobs/[id]" options={{ title: 'Job' }} />
      <Stack.Screen name="technicians" options={{ title: 'Technicians' }} />
      <Stack.Screen name="reports" options={{ title: 'Performance' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
    </Stack>
  );
}
