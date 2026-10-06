import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

export function ScreenBody({
  loading,
  error,
  empty,
  emptyLabel,
  onRetry,
  children,
}: {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyLabel?: string;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#0B4F6C" />
        <Text style={styles.note}>Loading…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        {onRetry ? <Button mode="contained" onPress={onRetry}>Try again</Button> : null}
      </View>
    );
  }
  if (empty) {
    return (
      <View style={styles.center}>
        <Text style={styles.note}>{emptyLabel ?? 'Nothing here yet.'}</Text>
        {children}
      </View>
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  note: { color: '#334155', textAlign: 'center' },
  error: { color: '#EF4444', textAlign: 'center' },
});
