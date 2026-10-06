import { Stack } from 'expo-router';
import { palette } from '../../src/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.primary },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: palette.bg },
      }}
    >
      <Stack.Screen name="login" options={{ title: 'Sign in', headerShown: false }} />
      <Stack.Screen name="register" options={{ title: 'Create account' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
      <Stack.Screen name="otp-verify" options={{ title: 'Phone code' }} />
    </Stack>
  );
}
