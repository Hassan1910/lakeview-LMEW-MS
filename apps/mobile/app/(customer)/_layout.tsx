import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { HeaderBack } from '../../src/components/HeaderBack';
import { palette } from '../../src/theme';

function CustomerBack() {
  return <HeaderBack fallback="/(customer)/home" />;
}

const hidden = (title: string) => ({
  href: null as null,
  title,
  headerLeft: CustomerBack,
});

export default function CustomerTabsLayout() {
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
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home-variant-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="my-requests" options={{ title: 'Requests', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="clipboard-text-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="new-request" options={{ title: 'New', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="plus-circle-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="invoices" options={{ title: 'Invoices', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="credit-card-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="request/[id]" options={hidden('Request')} />
      <Tabs.Screen name="vessels" options={hidden('Vessels')} />
      <Tabs.Screen name="vessel/[id]" options={hidden('Vessel')} />
      <Tabs.Screen name="quotations" options={hidden('Quotations')} />
      <Tabs.Screen name="invoice/[id]" options={hidden('Invoice')} />
      <Tabs.Screen name="pay/[invoiceId]" options={hidden('Pay')} />
      <Tabs.Screen name="notifications" options={hidden('Notifications')} />
      <Tabs.Screen name="feedback/[serviceRequestId]" options={hidden('Feedback')} />
      <Tabs.Screen name="about" options={hidden('About')} />
      <Tabs.Screen name="help" options={hidden('Help')} />
      <Tabs.Screen name="contact" options={hidden('Contact')} />
      <Tabs.Screen name="search" options={hidden('Search')} />
    </Tabs>
  );
}
