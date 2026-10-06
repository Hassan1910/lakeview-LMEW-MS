import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const hidden = { href: null } as const;

export default function CustomerTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0B4F6C' },
        headerTintColor: '#FFFFFF',
        tabBarActiveTintColor: '#0B4F6C',
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="ship-wheel" color={color} size={size} /> }} />
      <Tabs.Screen name="my-requests" options={{ title: 'Requests', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="clipboard-list" color={color} size={size} /> }} />
      <Tabs.Screen name="new-request" options={{ title: 'New', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="plus-circle" color={color} size={size} /> }} />
      <Tabs.Screen name="invoices" options={{ title: 'Pay', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="credit-card-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account" color={color} size={size} /> }} />
      {['request/[id]', 'vessels', 'vessel/[id]', 'quotations', 'invoice/[id]', 'pay/[invoiceId]', 'notifications', 'feedback/[serviceRequestId]', 'about', 'help', 'contact', 'search'].map((name) => (
        <Tabs.Screen key={name} name={name} options={hidden} />
      ))}
    </Tabs>
  );
}
