import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { palette } from '../theme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export function SettingsRow({
  icon,
  label,
  detail,
  danger = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const color = danger ? palette.danger : palette.text;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}>
      <MaterialCommunityIcons name={icon} size={22} color={danger ? palette.danger : palette.primary} />
      <View style={styles.copy}>
        <Text style={[styles.label, { color }]} numberOfLines={1}>{label}</Text>
        {detail ? <Text style={styles.detail} numberOfLines={1}>{detail}</Text> : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={palette.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  pressed: { opacity: 0.7 },
  copy: { flex: 1, minWidth: 0 },
  label: { fontSize: 15, fontWeight: '600' },
  detail: { color: palette.muted, fontSize: 13, marginTop: 2 },
});
