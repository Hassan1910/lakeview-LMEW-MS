import React from 'react';

export function DataState({
  loading,
  error,
  empty,
  emptyLabel,
  children,
}: {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyLabel?: string;
  children: React.ReactNode;
}) {
  if (loading) return <p className="p-6 text-slate-500">Loading…</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (empty) return <p className="p-6 text-slate-500">{emptyLabel ?? 'Nothing to show.'}</p>;
  return <>{children}</>;
}
