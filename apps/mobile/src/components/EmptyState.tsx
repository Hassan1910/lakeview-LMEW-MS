import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { palette, ui } from '../theme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export function EmptyState({
  icon = 'inbox-outline',
  title,
  message,
  actionLabel,
  onAction,
  fill = false,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  fill?: boolean;
}) {
  return (
    <View style={[styles.wrap, fill ? styles.fill : null]}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name={icon} size={28} color={palette.primary} />
      </View>
      <Text style={[ui.section, styles.center]}>{title}</Text>
      {message ? <Text style={[ui.muted, styles.center]}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Button mode="contained" onPress={onAction} style={styles.action}>{actionLabel}</Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, paddingHorizontal: 16, gap: 8 },
  fill: { flex: 1 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.infoBg,
    marginBottom: 4,
  },
  center: { textAlign: 'center' },
  action: { marginTop: 8, alignSelf: 'stretch' },
});
