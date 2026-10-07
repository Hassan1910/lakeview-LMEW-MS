import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { BrandMark } from './BrandMark';
import { palette, ui } from '../theme';

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  trailing,
}: {
  eyebrow?: string | null;
  title: string;
  subtitle?: string | null;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <BrandMark size={40} />
      <View style={styles.copy}>
        {eyebrow ? <Text style={ui.caption} numberOfLines={1}>{eyebrow}</Text> : null}
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={ui.caption} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: palette.text, fontSize: 22, fontWeight: '700', lineHeight: 28 },
});
