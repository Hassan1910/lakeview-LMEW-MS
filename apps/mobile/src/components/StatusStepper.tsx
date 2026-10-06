import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { SERVICE_STATUS_ORDER, serviceStatusConfig } from '@lmew/ui-tokens';

export function StatusStepper({ status }: { status: string }) {
  const current = serviceStatusConfig[status as keyof typeof serviceStatusConfig];
  if (status === 'cancelled') {
    return <Text style={{ color: '#EF4444', marginVertical: 8 }}>Cancelled</Text>;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {SERVICE_STATUS_ORDER.map((key) => {
        const item = serviceStatusConfig[key];
        const active = current ? item.stepIndex <= current.stepIndex : false;
        return (
          <View key={key} style={[styles.step, active && { borderColor: item.color }]}>
            <Text style={{ color: active ? item.color : '#94A3B8', fontSize: 11 }}>{item.label}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  step: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 8, marginRight: 8 },
});
