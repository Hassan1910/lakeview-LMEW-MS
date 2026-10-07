import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { palette, radius, ui } from '../theme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export type MetaLine = { icon: IconName; text: string };

export function RecordCard({
  title,
  subtitle,
  value,
  badges,
  lines = [],
  actionLabel,
  onAction,
  actionQuiet = false,
  secondaryIcon,
  secondaryLabel,
  onSecondary,
  onPress,
}: {
  title: string;
  subtitle?: string | null;
  value?: string | null;
  badges?: React.ReactNode;
  lines?: MetaLine[];
  actionLabel?: string;
  onAction?: () => void;
  actionQuiet?: boolean;
  secondaryIcon?: IconName;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onPress?: () => void;
}) {
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [styles.main, pressed && onPress ? styles.pressed : null]}
      >
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text style={styles.title} numberOfLines={2}>{title}</Text>
            {subtitle ? <Text style={ui.caption} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
          {value ? <Text style={styles.value} numberOfLines={1}>{value}</Text> : null}
        </View>
        {badges ? <View style={styles.badges}>{badges}</View> : null}
        {lines.filter((line) => line.text).map((line) => (
          <View key={`${line.icon}-${line.text}`} style={styles.line}>
            <MaterialCommunityIcons name={line.icon} size={16} color={palette.muted} />
            <Text style={styles.lineText} numberOfLines={2}>{line.text}</Text>
          </View>
        ))}
      </Pressable>
      {actionLabel || onSecondary ? (
        <View style={styles.actions}>
          {onSecondary && secondaryIcon ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={secondaryLabel ?? 'More'}
              onPress={onSecondary}
              hitSlop={6}
              style={styles.iconBtn}
            >
              <MaterialCommunityIcons name={secondaryIcon} size={22} color={palette.primary} />
            </Pressable>
          ) : <View />}
          {actionLabel ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={actionLabel}
              onPress={onAction ?? onPress}
              style={styles.action}
            >
              <Text style={[styles.actionText, actionQuiet ? styles.actionQuiet : null]}>{actionLabel}</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={actionQuiet ? palette.muted : palette.primary} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  main: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10, gap: 8 },
  pressed: { backgroundColor: '#F8FAFC' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titleCopy: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: palette.text, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  value: { color: palette.text, fontSize: 15, fontWeight: '700', flexShrink: 0, maxWidth: '46%' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  lineText: { flex: 1, color: palette.muted, fontSize: 13, lineHeight: 18 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingLeft: 6,
    paddingRight: 8,
    minHeight: 44,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  action: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 8 },
  actionText: { color: palette.primary, fontSize: 14, fontWeight: '700' },
  actionQuiet: { color: palette.primary, fontWeight: '600' },
});
