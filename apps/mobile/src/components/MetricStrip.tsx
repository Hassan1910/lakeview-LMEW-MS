import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { palette, radius } from '../theme';

export function MetricStrip({ items }: { items: { label: string; value: string }[] }) {
  return (
    <View style={styles.strip} accessibilityRole="summary">
      {items.map((item, index) => (
        <React.Fragment key={item.label}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <View style={styles.cell}>
            <Text style={styles.value} numberOfLines={1}>{item.value}</Text>
            <Text style={styles.label} numberOfLines={2}>{item.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: palette.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 12,
  },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, gap: 2, minWidth: 0 },
  value: { color: palette.text, fontSize: 18, fontWeight: '700' },
  label: { color: palette.muted, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  divider: { width: 1, backgroundColor: palette.border },
});
