import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db, watch } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { formatMoney, formatWhen, statusLabel } from '../lib/format';
import { useConfirm } from '../components/confirm';
import { DataState } from '../components/DataState';
import { Button, Card, Field, Notice, Page, StatusBadge, inputClass, linkClass } from '../components/ui';

const nextStatus: Record<string, string[]> = {
  request_received: ['inspection_in_progress', 'cancelled'],
  inspection_in_progress: ['quotation_pending', 'awaiting_spare_parts', 'cancelled'],
  quotation_pending: ['quotation_sent', 'awaiting_approval', 'cancelled'],
  quotation_sent: ['awaiting_approval', 'cancelled'],
  awaiting_approval: ['under_repair', 'awaiting_spare_parts', 'cancelled'],
  awaiting_spare_parts: ['under_repair', 'cancelled'],
  under_repair: ['testing', 'awaiting_spare_parts', 'completed', 'cancelled'],
  testing: ['under_repair', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

type Line = { description: string; quantity: number; unit_price: number; inventory_item_id: string | null };
type Attachment = { file_name: string; storage_path: string; url?: string };

export const ServiceRequestDetail: React.FC = () => {
  const { id } = useParams();
  const { profile, can } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([{ description: 'Labour', quantity: 1, unit_price: 0, inventory_item_id: null }]);
  const [files, setFiles] = useState<Attachment[]>([]);
  const canQuote = can('quotations.create');
  const canSendQuote = can('quotations.submit');
  const canInvoice = can('invoices.approve');
  const canEdit = can('service_requests.edit');
  const canAssignManager = can('service_requests.assign');
  const canAssignTech = can('work_orders.assign') && can('work_orders.create');
  const canMessage = can('messages.create');
  const canViewMessages = can('messages.view') || canMessage;
  const confirm = useConfirm();

  const query = useQuery({
    queryKey: ['admin-request', id],
    queryFn: async () => {
      const request = await db().from('service_requests').select('*, history:service_request_status_history(status, note, created_at), attachments:service_request_attachments(file_name, storage_path), quotations(id, code, status, total, currency), invoices(id, code, status, balance)').eq('id', id).single();
      if (request.error) throw request.error;
      const [managers, technicians, thread, catalog, supervisors] = await Promise.all([
        db().rpc('assignable_profiles', { p_permission: 'service_requests.assign' }),
        db().rpc('assignable_profiles', { p_permission: 'work_orders.execute' }),
        db().from('messages').select('id, body, created_at').eq('service_request_id', id).order('created_at'),
        db().from('inventory_items').select('id, name, unit_price').eq('is_active', true).order('name'),
        db().rpc('assignable_profiles', { p_permission: 'work_orders.assign' }),
      ]);
      const failed = managers.error ?? technicians.error ?? thread.error ?? catalog.error ?? supervisors.error;
      if (failed) throw failed;
      return {
        request: request.data,
        managers: managers.data ?? [],
        technicians: technicians.data ?? [],
        supervisors: supervisors.data ?? [],
        messages: thread.data ?? [],
        catalog: catalog.data ?? [],
      };
    },
  });
  useEffect(() => {
    const stopRequest = watch('service_requests', () => queryClient.invalidateQueries({ queryKey: ['admin-request', id] }), `id=eq.${id}`);
    const stopMessages = watch('messages', () => queryClient.invalidateQueries({ queryKey: ['admin-request', id] }), `service_request_id=eq.${id}`);
    return () => { stopRequest(); stopMessages(); };
  }, [id, queryClient]);

  useEffect(() => {
    const attachments = (query.data?.request?.attachments ?? []) as Attachment[];
    void Promise.all(attachments.map(async (file) => {
      const signed = await db().storage.from('service-attachments').createSignedUrl(file.storage_path, 3600);
      return { ...file, url: signed.data?.signedUrl };
    })).then(setFiles);
  }, [query.data?.request]);

  const save = async (patch: Record<string, string>) => {
    const { error: updateError } = await db().from('service_requests').update(patch).eq('id', id);
    setError(updateError?.message ?? null);
    setSuccess(updateError ? null : 'Saved');
    queryClient.invalidateQueries({ queryKey: ['admin-request', id] });
  };
  const assignTech = async (technicianId: string, supervisorId: string) => {
    const { error: insertError } = await db().from('work_orders').insert({
      service_request_id: id,
      assigned_to: technicianId,
      supervisor_id: supervisorId || null,
      created_by: profile?.id,
    });
    setError(insertError?.message ?? null);
    setSuccess(insertError ? null : 'Technician assigned');
  };
  const sendMessage = async () => {
    if (!profile || !message.trim()) return;
    const { error: insertError } = await db().from('messages').insert({ service_request_id: id, sender_id: profile.id, body: message });
    if (!insertError) setMessage('');
    setError(insertError?.message ?? null);
    queryClient.invalidateQueries({ queryKey: ['admin-request', id] });
  };
  const saveQuote = async (send: boolean) => {
    if (!profile) return;
    const created = await db().from('quotations').insert({
      service_request_id: id,
      created_by: profile.id,
      status: 'draft',
    }).select('id').single();
    if (created.error || !created.data) return setError(created.error?.message ?? 'Could not create quotation');
    const items = await db().from('quotation_items').insert(lines.filter((line) => line.description).map((line) => ({
      quotation_id: created.data.id,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_price,
      inventory_item_id: line.inventory_item_id,
    })));
    if (items.error) return setError(items.error.message);
    if (send) {
      const sent = await db().from('quotations').update({ status: 'sent' }).eq('id', created.data.id);
      if (sent.error) return setError(sent.error.message);
    }
    setSuccess(send ? 'Quotation sent' : 'Quotation saved as draft');
    setError(null);
    queryClient.invalidateQueries({ queryKey: ['admin-request', id] });
  };
  const issue = async (quotationId: string) => {
    const ok = await confirm({ title: 'Issue invoice', description: 'Create an invoice from this accepted quotation?', confirmLabel: 'Issue invoice', tone: 'primary' });
    if (!ok) return;
    const { error: rpcError } = await db().rpc('issue_invoice_from_quotation', { p_quotation_id: quotationId });
    setError(rpcError?.message ?? null);
    setSuccess(rpcError ? null : 'Invoice issued from quotation');
    queryClient.invalidateQueries({ queryKey: ['admin-request', id] });
  };

  const changeStatus = async (next: string) => {
    if (next === 'cancelled') {
      const ok = await confirm({ title: 'Cancel request', description: 'Mark this service request as cancelled?', confirmLabel: 'Cancel request' });
      if (!ok) return;
    }
    save({ status: next });
  };

  const row = query.data?.request;
  return (
    <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!row} emptyLabel="Request not found.">
      {row ? (
        <Page title={`${row.code ?? 'Request'} · ${row.title}`} description={row.description || 'No description yet.'} actions={<Link className={`text-sm ${linkClass}`} to="/service-requests">All requests</Link>}>
          <Notice tone="error">{error}</Notice>
          <Notice tone="success">{success}</Notice>
          <Card title="Assignment">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Status">
                <select className={inputClass} disabled={!canEdit} value={row.status ?? ''} onChange={(event) => changeStatus(event.target.value)}>
                  {[row.status, ...(nextStatus[row.status] ?? [])].filter((status, index, all) => status && all.indexOf(status) === index).map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                </select>
              </Field>
              <Field label="Service manager">
                <select className={inputClass} disabled={!canAssignManager} value={row.assigned_service_manager ?? ''} onChange={(event) => save({ assigned_service_manager: event.target.value })}>
                  <option value="">Unassigned</option>
                  {(query.data?.managers ?? []).map((person: { id: string; full_name: string | null }) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
                </select>
              </Field>
            </div>
            {canAssignTech ? <AssignForm technicians={query.data?.technicians ?? []} supervisors={query.data?.supervisors ?? []} onAssign={assignTech} /> : null}
          </Card>
          <div className="grid gap-3 lg:grid-cols-2">
            <Card title="Timeline">
              {(row.history ?? []).length === 0 ? <p className="text-sm text-slate-500">No status changes yet.</p> : (
                <ul className="space-y-2 text-sm">
                  {(row.history ?? []).map((item: { status: string; note: string | null; created_at: string }, index: number) => (
                    <li key={index} className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={item.status} />
                      <span className="text-slate-500">{formatWhen(item.created_at)}</span>
                      {item.note ? <span>{item.note}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Attachments">
              {files.length === 0 ? <p className="text-sm text-slate-500">No attachments.</p> : (
                <ul className="space-y-1 text-sm">
                  {files.map((file) => <li key={file.storage_path}>{file.url ? <a className={linkClass} href={file.url} target="_blank" rel="noreferrer">{file.file_name}</a> : file.file_name}</li>)}
                </ul>
              )}
            </Card>
          </div>
          <Card title="Quotations">
            {(row.quotations ?? []).length === 0 ? <p className="text-sm text-slate-500">No quotations yet.</p> : (
              <ul className="space-y-2 text-sm">
                {(row.quotations ?? []).map((quote: { id: string; code: string; status: string; total: number; currency: string }) => (
                  <li key={quote.id} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{quote.code}</span>
                    <StatusBadge status={quote.status} />
                    <span>{formatMoney(quote.total, quote.currency)}</span>
                    {canInvoice && quote.status === 'accepted' ? <Button variant="secondary" onClick={() => issue(quote.id)}>Issue invoice</Button> : null}
                  </li>
                ))}
              </ul>
            )}
            {canQuote ? (
              <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                {lines.map((line, index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-4">
                    <select aria-label="Inventory item" className={inputClass} value={line.inventory_item_id ?? ''} onChange={(event) => {
                      const item = query.data?.catalog.find((part) => part.id === event.target.value);
                      const next = [...lines];
                      next[index] = { ...line, inventory_item_id: event.target.value || null, description: item?.name ?? line.description, unit_price: Number(item?.unit_price ?? line.unit_price) };
                      setLines(next);
                    }}>
                      <option value="">Custom line</option>
                      {query.data?.catalog.map((part) => <option key={part.id} value={part.id}>{part.name}</option>)}
                    </select>
                    <input aria-label="Description" className={inputClass} value={line.description} onChange={(event) => updateLine(lines, setLines, index, { description: event.target.value })} />
                    <input aria-label="Quantity" className={inputClass} type="number" value={line.quantity} onChange={(event) => updateLine(lines, setLines, index, { quantity: Number(event.target.value) })} />
                    <input aria-label="Unit price" className={inputClass} type="number" value={line.unit_price} onChange={(event) => updateLine(lines, setLines, index, { unit_price: Number(event.target.value) })} />
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setLines([...lines, { description: '', quantity: 1, unit_price: 0, inventory_item_id: null }])}>Add line</Button>
                  <Button variant="secondary" onClick={() => saveQuote(false)}>Save draft</Button>
                  {canSendQuote ? <Button onClick={() => saveQuote(true)}>Send quotation</Button> : null}
                </div>
              </div>
            ) : null}
          </Card>
          <Card title="Invoices">
            {(row.invoices ?? []).length === 0 ? <p className="text-sm text-slate-500">No invoices yet.</p> : (
              <ul className="space-y-2 text-sm">
                {(row.invoices ?? []).map((invoice: { id: string; code: string; status: string; balance: number }) => (
                  <li key={invoice.id} className="flex flex-wrap items-center gap-2">
                    <Link className={`font-medium ${linkClass}`} to={`/invoices/${invoice.id}`}>{invoice.code}</Link>
                    <StatusBadge status={invoice.status} />
                    <span>Balance {formatMoney(invoice.balance)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {canViewMessages ? (
            <Card title="Messages">
              {query.data?.messages.length === 0 ? <p className="text-sm text-slate-500">No messages yet.</p> : (
                <ul className="space-y-2 text-sm">
                  {query.data?.messages.map((item) => <li key={item.id}><span className="text-slate-500">{formatWhen(item.created_at)}</span> · {item.body}</li>)}
                </ul>
              )}
              {canMessage ? (
                <div className="mt-3 space-y-2">
                  <Field label="Message">
                    <textarea className={inputClass} rows={3} value={message} onChange={(event) => setMessage(event.target.value)} />
                  </Field>
                  <Button onClick={sendMessage}>Send</Button>
                </div>
              ) : null}
            </Card>
          ) : null}
        </Page>
      ) : null}
    </DataState>
  );
};

function updateLine(lines: Line[], setLines: (lines: Line[]) => void, index: number, patch: Partial<Line>) {
  const next = [...lines];
  next[index] = { ...next[index], ...patch };
  setLines(next);
}

function AssignForm({ technicians, supervisors, onAssign }: { technicians: { id: string; full_name: string }[]; supervisors: { id: string; full_name: string }[]; onAssign: (technicianId: string, supervisorId: string) => void }) {
  const [technicianId, setTechnicianId] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  return (
    <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-3 dark:border-slate-800">
      <Field label="Technician">
        <select className={inputClass} value={technicianId} onChange={(event) => setTechnicianId(event.target.value)}>
          <option value="">Choose</option>
          {technicians.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
        </select>
      </Field>
      <Field label="Supervisor">
        <select className={inputClass} value={supervisorId} onChange={(event) => setSupervisorId(event.target.value)}>
          <option value="">None</option>
          {supervisors.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
        </select>
      </Field>
      <div className="flex items-end"><Button variant="secondary" onClick={() => technicianId && onAssign(technicianId, supervisorId)}>Assign technician</Button></div>
    </div>
  );
}
