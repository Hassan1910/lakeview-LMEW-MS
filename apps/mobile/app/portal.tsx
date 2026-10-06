import { Button, Text } from 'react-native-paper';
import { useAuthStore } from '../src/store/authStore';
import { Page } from '../src/components/ui';
import { ui } from '../src/theme';

export default function PortalScreen() {
  const signOut = useAuthStore((s) => s.signOut);
  const profile = useAuthStore((s) => s.profile);
  return (
    <Page>
      <Text style={ui.title}>This role uses the web portal</Text>
      <Text style={ui.body}>
        {profile?.full_name}, sign in to the admin dashboard or staff portal in a browser. The mobile app is for customers, technicians, and supervisors.
      </Text>
      <Button mode="contained" onPress={signOut}>Sign out</Button>
    </Page>
  );
}
