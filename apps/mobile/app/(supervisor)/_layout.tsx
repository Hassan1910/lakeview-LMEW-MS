import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { HeaderBack } from '../../src/components/HeaderBack';
import { palette } from '../../src/theme';

function SupervisorBack() {
  return <HeaderBack fallback="/(supervisor)/home" />;
}

const hidden = (title: string) => ({
  href: null as null,
  title,
  headerLeft: SupervisorBack,
});

export default function SupervisorLayout() {
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
      <Tabs.Screen name="home" options={{ title: 'Team', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-group-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="team-jobs/index" options={{ title: 'Jobs', tabBarLabel: 'Jobs', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="clipboard-list-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="notifications" options={{ title: 'Alerts', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="bell-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="overview" options={hidden('Team')} />
      <Tabs.Screen name="team-jobs/[id]" options={hidden('Job')} />
      <Tabs.Screen name="technicians" options={hidden('Technicians')} />
      <Tabs.Screen name="reports" options={hidden('Performance')} />
      <Tabs.Screen name="about" options={hidden('About')} />
      <Tabs.Screen name="help" options={hidden('Help')} />
      <Tabs.Screen name="contact" options={hidden('Contact')} />
    </Tabs>
  );
}
