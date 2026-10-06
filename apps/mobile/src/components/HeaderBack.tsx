import React from 'react';
import { Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export function HeaderBack({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={8}
      onPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace(fallback as never);
      }}
      style={{ marginLeft: 4, padding: 8 }}
    >
      <MaterialCommunityIcons name="chevron-left" size={26} color="#FFFFFF" />
    </Pressable>
  );
}
