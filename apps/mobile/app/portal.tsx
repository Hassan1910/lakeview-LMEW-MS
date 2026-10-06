import { Button, Text } from 'react-native-paper';
import { View } from 'react-native';
import { useAuthStore } from '../src/store/authStore';

export default function PortalScreen() {
  const signOut = useAuthStore((s) => s.signOut);
  const profile = useAuthStore((s) => s.profile);
  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 12 }}>
      <Text variant="titleMedium">This role uses the web portal</Text>
      <Text>
        {profile?.full_name}, sign in to the admin dashboard or staff portal in a browser. The mobile app is for customers, technicians, and supervisors.
      </Text>
      <Button mode="contained" onPress={signOut}>Sign out</Button>
    </View>
  );
}
