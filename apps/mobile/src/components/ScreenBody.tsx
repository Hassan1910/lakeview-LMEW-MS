import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { friendlyError } from '../lib/format';
import { palette, ui } from '../theme';
import { EmptyState } from './EmptyState';
import { SkeletonList } from './Skeleton';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export function ScreenBody({
  loading,
  skeleton,
  error,
  empty,
  emptyLabel,
  emptyTitle,
  emptyIcon,
  emptyActionLabel,
  onEmptyAction,
  onRetry,
  children,
}: {
  loading?: boolean;
  skeleton?: number;
  error?: string | null;
  empty?: boolean;
  emptyLabel?: string;
  emptyTitle?: string;
  emptyIcon?: IconName;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  if (loading) {
    if (skeleton) {
      return (
        <View style={[ui.screen, ui.pad]}>
          <SkeletonList count={skeleton} />
        </View>
      );
    }
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.primary} />
        <Text style={ui.muted}>Loading…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={ui.screen}>
        <EmptyState
          fill
          icon="alert-circle-outline"
          title="Something went wrong"
          message={friendlyError(error)}
          actionLabel={onRetry ? 'Try again' : undefined}
          onAction={onRetry}
        />
      </View>
    );
  }
  if (empty) {
    return (
      <View style={ui.screen}>
        <EmptyState
          fill
          icon={emptyIcon}
          title={emptyTitle ?? emptyLabel ?? 'Nothing here yet'}
          message={emptyTitle ? emptyLabel : undefined}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
        />
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
});
