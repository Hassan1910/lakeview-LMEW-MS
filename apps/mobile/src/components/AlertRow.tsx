import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatWhen } from '../lib/format';
import { palette, radius } from '../theme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const kinds: Record<string, { icon: IconName; label: string }> = {
  service_status: { icon: 'clipboard-text-clock-outline', label: 'Request update' },
  quotation: { icon: 'file-document-outline', label: 'Quotation' },
  invoice: { icon: 'receipt', label: 'Invoice' },
  payment: { icon: 'cash', label: 'Payment' },
  assignment: { icon: 'briefcase-outline', label: 'Assignment' },
  low_stock: { icon: 'package-variant', label: 'Stock' },
  feedback: { icon: 'star-outline', label: 'Feedback' },
  system: { icon: 'bell-outline', label: 'Notice' },
};

export function AlertRow({
  title,
  body,
  type,
  createdAt,
  unread,
  onPress,
}: {
  title: string;
  body?: string | null;
  type?: string | null;
  createdAt?: string | null;
  unread?: boolean;
  onPress: () => void;
}) {
  const kind = kinds[type ?? ''] ?? { icon: 'bell-outline' as IconName, label: 'Notice' };
  const important = type === 'assignment';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread' : 'Read'} ${kind.label}. ${title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, important ? styles.important : null, pressed ? styles.pressed : null]}
    >
      <View style={[styles.icon, important ? styles.iconImportant : null]}>
        <MaterialCommunityIcons name={kind.icon} size={20} color={important ? palette.warning : palette.primary} />
      </View>
      <View style={styles.copy}>
        <View style={styles.top}>
          <Text style={styles.kind}>{important ? 'Important · ' : ''}{kind.label}</Text>
          {createdAt ? <Text style={styles.time}>{formatWhen(createdAt, 'relative')}</Text> : null}
        </View>
        <Text style={[styles.title, unread ? styles.unread : null]} numberOfLines={2}>{title}</Text>
        {body ? <Text style={styles.body} numberOfLines={2}>{body}</Text> : null}
        <Text style={styles.state}>{unread ? 'Unread' : 'Read'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  important: { backgroundColor: palette.warningBg, borderColor: '#FDE68A' },
  pressed: { opacity: 0.92 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.infoBg,
  },
  iconImportant: { backgroundColor: '#FEF3C7' },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  kind: { color: palette.muted, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  time: { color: palette.muted, fontSize: 12 },
  title: { color: palette.text, fontSize: 15, lineHeight: 20 },
  unread: { fontWeight: '700' },
  body: { color: palette.muted, fontSize: 13, lineHeight: 18 },
  state: { color: palette.muted, fontSize: 12, marginTop: 2 },
});
