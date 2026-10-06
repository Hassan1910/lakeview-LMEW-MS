import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db, watch } from '../lib/supabase';
import { DataState } from '../components/DataState';
import { Card, Page, StatusBadge, linkClass } from '../components/ui';

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
    <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!row} emptyLabel="Work order not found.">
      {row ? (
        <Page title={row.code ?? 'Work order'} description="Job notes, media, and issued parts." actions={<Link className={`text-sm ${linkClass}`} to="/work-orders">Back to jobs</Link>}>
          <div className="flex items-center gap-2"><StatusBadge status={row.status} /></div>
          <Card title="Notes">
            <p className="text-sm text-slate-700 dark:text-slate-200">{row.notes || 'No notes.'}</p>
          </Card>
          <Card title="Media">
            {media.length === 0 ? <p className="text-sm text-slate-500">No media.</p> : (
              <ul className="space-y-1 text-sm">
                {media.map((item) => <li key={item.storage_path}>{item.url ? <a className={linkClass} href={item.url} target="_blank" rel="noreferrer">{item.kind}</a> : item.kind}</li>)}
              </ul>
            )}
          </Card>
          <Card title="Parts">
            {(row.parts ?? []).length === 0 ? <p className="text-sm text-slate-500">No parts issued.</p> : (
              <ul className="space-y-1 text-sm">
                {(row.parts ?? []).map((item: { quantity: number; inventory_item_id: string }, index: number) => <li key={index}>{item.quantity} of {item.inventory_item_id}</li>)}
              </ul>
            )}
          </Card>
        </Page>
      ) : null}
    </DataState>
  );
};
