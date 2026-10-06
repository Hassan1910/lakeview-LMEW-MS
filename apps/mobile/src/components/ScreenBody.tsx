import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { friendlyError } from '../lib/format';
import { palette, ui } from '../theme';

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
        <ActivityIndicator color={palette.primary} />
        <Text style={ui.muted}>Loading…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{friendlyError(error)}</Text>
        {onRetry ? <Button mode="contained" onPress={onRetry}>Try again</Button> : null}
      </View>
    );
  }
  if (empty) {
    return (
      <View style={styles.center}>
        <Text style={ui.body}>{emptyLabel ?? 'Nothing here yet.'}</Text>
      </View>
    );
  }
  return <View style={ui.screen}>{children}</View>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: palette.bg,
  },
  error: { color: palette.danger, textAlign: 'center', fontSize: 15, lineHeight: 22 },
});
