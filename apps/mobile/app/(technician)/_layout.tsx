import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { HeaderBack } from '../../src/components/HeaderBack';
import { palette } from '../../src/theme';

function TechnicianBack() {
  return <HeaderBack fallback="/(technician)/home" />;
}

const hidden = (title: string) => ({
  href: null as null,
  title,
  headerLeft: TechnicianBack,
});

export default function TechnicianLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: palette.primary },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: palette.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Today', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="briefcase-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="my-jobs" options={{ title: 'Jobs', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="clipboard-list-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="notifications" options={{ title: 'Alerts', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="bell-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="jobs" options={hidden('Jobs')} />
      <Tabs.Screen name="job/[id]/index" options={hidden('Job')} />
      <Tabs.Screen name="job/[id]/media" options={hidden('Photos')} />
      <Tabs.Screen name="job/[id]/parts" options={hidden('Parts')} />
      <Tabs.Screen name="about" options={hidden('About')} />
      <Tabs.Screen name="help" options={hidden('Help')} />
      <Tabs.Screen name="contact" options={hidden('Contact')} />
    </Tabs>
  );
}
