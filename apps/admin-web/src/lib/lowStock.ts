import { useQuery } from '@tanstack/react-query';
import { db } from './supabase';

/** Shared low-stock count so the sidebar and dashboard do not each download the catalogue. */
export function useLowStockCount(enabled: boolean) {
  return useQuery({
    queryKey: ['low-stock-count'],
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await db().rpc('low_stock_count');
      if (error) throw error;
      return Number(data ?? 0);
    },
  });
}
