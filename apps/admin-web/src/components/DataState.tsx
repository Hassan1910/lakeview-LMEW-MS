import React from 'react';
import { EmptyState, Notice, SkeletonRows } from './ui';

export function DataState({
  loading,
  error,
  empty,
  emptyLabel,
  emptyDescription,
  children,
}: {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyLabel?: string;
  emptyDescription?: string;
  children: React.ReactNode;
}) {
  if (loading) return <SkeletonRows />;
  if (error) return <Notice tone="error">{error}</Notice>;
  if (empty) return <EmptyState title={emptyLabel ?? 'Nothing to show'} description={emptyDescription} />;
  return <>{children}</>;
}
