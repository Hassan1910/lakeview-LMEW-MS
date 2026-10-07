import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { palette } from '../theme';

export function Avatar({ name, uri, size = 48 }: { name?: string | null; uri?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [uri]);
  const initials = (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';
  const shape = { width: size, height: size, borderRadius: size / 2 };
  if (uri && !failed) {
    return (
      <Image
        accessibilityLabel={name ? `${name} photo` : 'Profile photo'}
        source={{ uri }}
        onError={() => setFailed(true)}
        style={[shape, styles.image]}
      />
    );
  }
  return (
    <View accessibilityLabel={name ? `${name} photo` : 'Profile photo'} style={[shape, styles.fallback]}>
      <Text style={[styles.initials, { fontSize: Math.max(14, size * 0.34) }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: '#E2E8F0' },
  fallback: { backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' },
  initials: { color: palette.primary, fontWeight: '700' },
});
