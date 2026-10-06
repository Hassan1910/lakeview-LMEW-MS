import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { SERVICE_STATUS_ORDER, serviceStatusConfig } from '@lmew/ui-tokens';
import { palette } from '../theme';

export function StatusStepper({ status }: { status: string }) {
  const current = serviceStatusConfig[status as keyof typeof serviceStatusConfig];
  if (status === 'cancelled') {
    return <Text style={styles.cancelled}>This request was cancelled.</Text>;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {SERVICE_STATUS_ORDER.map((key, index) => {
        const item = serviceStatusConfig[key];
        const active = current ? item.stepIndex <= current.stepIndex : false;
        const here = key === status;
        return (
          <View key={key} style={styles.item}>
            <View style={[styles.dot, { backgroundColor: active ? item.color : palette.border }]} />
            {index < SERVICE_STATUS_ORDER.length - 1 ? <View style={[styles.line, active && { backgroundColor: item.color }]} /> : null}
            <Text style={[styles.label, here && { color: item.color, fontWeight: '700' }]} numberOfLines={2}>
              {item.label}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 4, gap: 0 },
  item: { width: 88, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  line: { position: 'absolute', top: 4, left: 49, width: 78, height: 2, backgroundColor: palette.border },
  label: { marginTop: 6, fontSize: 11, lineHeight: 14, textAlign: 'center', color: palette.muted },
  cancelled: { color: palette.danger, marginVertical: 4, fontSize: 14 },
});
