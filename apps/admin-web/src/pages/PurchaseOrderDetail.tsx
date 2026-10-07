import React, { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { purchaseOrderReceiveProblem } from '@lmew/shared-types';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { useConfirm } from '../components/confirm';
import { Badge, Button, Card, Field, Notice, Page, StatusBadge, Table, errorMessage, inputClass } from '../components/ui';

type PoLine = { id: string; description: string; quantity: number; unit_cost: number; line_total: number | null; inventory_item_id: string | null };

export const PurchaseOrderDetail: React.FC = () => {
  const { id } = useParams();
  const { pathname } = useLocation();
  const { can, profile } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [line, setLine] = useState({ itemId: '', description: '', quantity: '1', unitCost: '' });
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const order = useQuery({
    queryKey: ['po', id],
    queryFn: async () => {
      const { data, error } = await db()
        .from('purchase_orders')
        .select('*, supplier:suppliers(name, email, phone), approver:profiles!purchase_orders_approved_by_fkey(full_name)')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      const lines = await db().from('purchase_order_items').select('id, description, quantity, unit_cost, line_total, inventory_item_id').eq('purchase_order_id', id).order('id');
      if (lines.error) throw lines.error;
      return data ? { ...data, lines: (lines.data ?? []) as PoLine[] } : null;
    },
  });
  const catalog = useQuery({
    queryKey: ['inventory-options-cost'],
    enabled: can('purchase_orders.edit'),
    queryFn: async () => {
      const { data, error } = await db().from('inventory_items').select('id, name, sku, unit_cost').eq('is_active', true).order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['po', id] });
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    queryClient.invalidateQueries({ queryKey: ['my-orders'] });
  };

  const run = async (work: () => Promise<string | null>, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const failure = await work();
      setMessage(failure ? { tone: 'error', text: failure } : { tone: 'success', text: done });
      if (!failure) refresh();
    } finally {
      setBusy(false);
    }
  };

  const addLine = (event: React.FormEvent) => {
    event.preventDefault();
    const part = catalog.data?.find((item) => item.id === line.itemId);
    const quantity = Number(line.quantity);
    const unitCost = Number(line.unitCost || part?.unit_cost || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) return setMessage({ tone: 'error', text: 'Quantity must be more than zero.' });
    if (!part && !line.description.trim()) return setMessage({ tone: 'error', text: 'Choose an item or describe the line.' });
    void run(async () => {
      const { error } = await db().from('purchase_order_items').insert({
        purchase_order_id: id,
        inventory_item_id: line.itemId || null,
        description: line.description.trim() || part?.name || 'Item',
        quantity,
        unit_cost: unitCost,
      });
      if (!error) setLine({ itemId: '', description: '', quantity: '1', unitCost: '' });
      return error?.message ?? null;
    }, 'Line added.');
  };

  const removeLine = async (lineId: string) => {
    const ok = await confirm({ title: 'Remove line', description: 'Remove this line from the purchase order?', confirmLabel: 'Remove line' });
    if (!ok) return;
    return run(async () => {
    const { error } = await db().from('purchase_order_items').delete().eq('id', lineId);
    return error?.message ?? null;
  }, 'Line removed.');
  };

  const setStatus = (status: string, extra: Record<string, unknown> = {}) => run(async () => {
    const { data, error } = await db().from('purchase_orders').update({ status, ...extra }).eq('id', id).select('id');
    if (error) return error.message;
    return data?.length ? null : 'You do not have permission to change this order.';
  }, `Order marked ${status}.`);

  const receive = () => run(async () => {
    const problem = purchaseOrderReceiveProblem(((order.data?.lines ?? []) as PoLine[]).map((item) => ({ inventoryItemId: item.inventory_item_id })));
    if (problem) return problem;
    const { error } = await db().rpc('receive_purchase_order', { p_id: id });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['low-stock-count'] });
    return error?.message ?? null;
  }, 'Stock received and order closed.');

  const row = order.data;
  const supplier = row ? (Array.isArray(row.supplier) ? row.supplier[0] : row.supplier) : null;
  const approver = row ? (Array.isArray(row.approver) ? row.approver[0] : row.approver) : null;
  const editable = can('purchase_orders.edit') && row?.status === 'draft';
  const isSupplier = pathname.startsWith('/my-orders') && can('purchase_orders.edit_own');

  return (
    <DataState loading={order.isLoading} error={errorMessage(order.error)} empty={!row} emptyLabel="Purchase order not found or not visible to your role.">
      {row ? (
        <Page
          title={row.code ?? 'Draft purchase order'}
          description={`${supplier?.name ?? 'Unknown supplier'}${row.expected_date ? ` · expected ${row.expected_date}` : ''}`}
          actions={<Link className="text-sm text-lmew-blue-800 hover:underline dark:text-sky-300" to={isSupplier ? '/my-orders' : '/purchase-orders'}>Back</Link>}
        >
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={row.status} />
            <span className="text-lg font-semibold">{row.currency ?? 'KES'} {Number(row.total ?? 0).toLocaleString()}</span>
            {approver?.full_name ? <span className="text-sm text-slate-500">Approved by {approver.full_name}</span> : null}
          </div>
          {row.notes ? <p className="text-sm text-slate-600 dark:text-slate-400">{row.notes}</p> : null}

          <div className="flex flex-wrap gap-2">
            {row.status === 'draft' && can('purchase_orders.approve') ? <Button disabled={busy || !row.lines.length} onClick={() => setStatus('sent', { approved_by: profile?.id })}>Approve and send</Button> : null}
            {isSupplier && row.status === 'sent' ? <Button disabled={busy} onClick={() => setStatus('acknowledged')}>Acknowledge</Button> : null}
            {isSupplier && (row.status === 'sent' || row.status === 'acknowledged') ? <Button disabled={busy} variant="secondary" onClick={() => setStatus('shipped')}>Mark shipped</Button> : null}
            {['sent', 'acknowledged', 'shipped'].includes(row.status) && can('stock_movements.create') && can('purchase_orders.edit') ? <Button disabled={busy} onClick={async () => { if (await confirm({ title: 'Receive stock', description: 'Receive these lines into inventory and close the order?', confirmLabel: 'Receive stock', tone: 'primary' })) receive(); }}>Receive into stock</Button> : null}
            {['draft', 'sent'].includes(row.status) && can('purchase_orders.edit') ? <Button disabled={busy} variant="danger" onClick={async () => { if (await confirm({ title: 'Cancel order', description: 'Cancel this purchase order?', confirmLabel: 'Cancel order' })) setStatus('cancelled'); }}>Cancel order</Button> : null}
          </div>
          {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

          {editable ? (
            <Card title="Add line">
              <form className="grid gap-3 md:grid-cols-5" onSubmit={addLine}>
                <div className="md:col-span-2">
                  <Field label="Inventory item">
                    <select className={inputClass} value={line.itemId} onChange={(e) => setLine({ ...line, itemId: e.target.value })}>
                      <option value="">Non-stock line…</option>
                      {(catalog.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Description"><input className={inputClass} value={line.description} onChange={(e) => setLine({ ...line, description: e.target.value })} /></Field>
                <Field label="Qty"><input className={inputClass} inputMode="decimal" value={line.quantity} onChange={(e) => setLine({ ...line, quantity: e.target.value })} /></Field>
                <Field label="Unit cost" hint="Defaults to the item cost"><input className={inputClass} inputMode="decimal" value={line.unitCost} onChange={(e) => setLine({ ...line, unitCost: e.target.value })} /></Field>
                <div><Button type="submit" disabled={busy}>Add line</Button></div>
              </form>
            </Card>
          ) : null}

          <Card title="Lines">
            {row.lines.length ? (
              <Table head={['Description', 'Qty', 'Unit cost', 'Line total', '']}>
                {(row.lines as PoLine[]).map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2">{item.description}{item.inventory_item_id ? null : <> <Badge>non-stock</Badge></>}</td>
                    <td className="px-3 py-2">{item.quantity}</td>
                    <td className="px-3 py-2">{Number(item.unit_cost).toLocaleString()}</td>
                    <td className="px-3 py-2">{Number(item.line_total ?? item.quantity * item.unit_cost).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{editable ? <Button variant="secondary" disabled={busy} onClick={() => removeLine(item.id)}>Remove</Button> : null}</td>
                  </tr>
                ))}
              </Table>
            ) : <p className="text-sm text-slate-500">No lines yet.</p>}
          </Card>
        </Page>
      ) : null}
    </DataState>
  );
};
