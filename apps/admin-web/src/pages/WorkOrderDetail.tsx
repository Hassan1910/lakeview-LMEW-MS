import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db, watch } from '../lib/supabase';
import { DataState } from '../components/DataState';

export const WorkOrderDetail: React.FC = () => {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [media, setMedia] = useState<{ kind: string; storage_path: string; url?: string }[]>([]);
  const query = useQuery({
    queryKey: ['work-order', id],
    queryFn: async () => {
      const { data, error } = await db().from('work_orders').select('*, media:work_order_media(kind, storage_path), parts:work_order_parts(quantity, inventory_item_id)').eq('id', id).single();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => watch('work_orders', () => queryClient.invalidateQueries({ queryKey: ['work-order', id] }), `id=eq.${id}`), [id, queryClient]);
  useEffect(() => {
    const rows = (query.data?.media ?? []) as { kind: string; storage_path: string }[];
    void Promise.all(rows.map(async (item) => {
      const signed = await db().storage.from('work-order-media').createSignedUrl(item.storage_path, 3600);
      return { ...item, url: signed.data?.signedUrl };
    })).then(setMedia);
  }, [query.data]);
  const row = query.data;
  return (
    <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null}>
      <h1 className="text-xl">{row?.code}</h1>
      <p>Status {row?.status}</p>
      <p>{row?.notes || 'No notes.'}</p>
      <h2 className="mt-4 font-semibold">Media</h2>
      {media.length === 0 ? <p>No media.</p> : media.map((item) => <p key={item.storage_path}>{item.url ? <a href={item.url}>{item.kind}</a> : item.kind}</p>)}
      <h2 className="mt-4 font-semibold">Parts</h2>
      {(row?.parts ?? []).length === 0 ? <p>No parts issued.</p> : (row?.parts ?? []).map((item: { quantity: number; inventory_item_id: string }, index: number) => <p key={index}>{item.quantity} of {item.inventory_item_id}</p>)}
    </DataState>
  );
};
