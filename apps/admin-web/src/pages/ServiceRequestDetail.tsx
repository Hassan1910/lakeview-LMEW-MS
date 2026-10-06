import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db, watch } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';

const statuses = ['request_received', 'inspection_in_progress', 'quotation_pending', 'quotation_sent', 'awaiting_approval', 'awaiting_spare_parts', 'under_repair', 'testing', 'completed', 'cancelled'];

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

  const query = useQuery({
    queryKey: ['admin-request', id],
    queryFn: async () => {
      const request = await db().from('service_requests').select('*, history:service_request_status_history(status, note, created_at), attachments:service_request_attachments(file_name, storage_path), quotations(id, code, status, total, currency), invoices(id, code, status, balance)').eq('id', id).single();
      if (request.error) throw request.error;
      const [managers, technicians, thread, catalog, supervisors] = await Promise.all([
        db().from('profiles').select('id, full_name').eq('role', 'service_manager'),
        db().from('profiles').select('id, full_name').eq('role', 'technician'),
        db().from('messages').select('id, body, created_at').eq('service_request_id', id).order('created_at'),
        db().from('inventory_items').select('id, name, unit_price').eq('is_active', true).order('name'),
        db().from('profiles').select('id, full_name').eq('role', 'supervisor'),
      ]);
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
    const { error: rpcError } = await db().rpc('issue_invoice_from_quotation', { p_quotation_id: quotationId });
    setError(rpcError?.message ?? null);
    setSuccess(rpcError ? null : 'Invoice issued from quotation');
    queryClient.invalidateQueries({ queryKey: ['admin-request', id] });
  };

  const row = query.data?.request;
  return (
    <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null}>
      <h1 className="text-xl font-semibold">{row?.code} · {row?.title}</h1>
      <p className="my-2">{row?.description}</p>
      {error ? <p className="text-red-600">{error}</p> : null}
      {success ? <p className="text-green-600">{success}</p> : null}
      <label className="mt-4 block">Status
        <select className="ml-2 rounded border p-1" disabled={!canEdit} value={row?.status ?? ''} onChange={(event) => save({ status: event.target.value })}>
          {statuses.map((status) => <option key={status}>{status}</option>)}
        </select>
      </label>
      <label className="mt-2 block">Service manager
        <select className="ml-2 rounded border p-1" disabled={!canAssignManager} value={row?.assigned_service_manager ?? ''} onChange={(event) => save({ assigned_service_manager: event.target.value })}>
          <option value="">Unassigned</option>
          {query.data?.managers.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
        </select>
      </label>
      {canAssignTech ? <AssignForm technicians={query.data?.technicians ?? []} supervisors={query.data?.supervisors ?? []} onAssign={assignTech} /> : null}
      <h2 className="mt-4 font-semibold">Timeline</h2>
      {(row?.history ?? []).length === 0 ? <p>No status changes yet.</p> : (row?.history ?? []).map((item: { status: string; note: string | null; created_at: string }, index: number) => <p key={index}>{item.created_at} · {item.status} · {item.note}</p>)}
      <h2 className="mt-4 font-semibold">Attachments</h2>
      {files.length === 0 ? <p>No attachments.</p> : files.map((file) => <p key={file.storage_path}>{file.url ? <a className="text-[#0B4F6C]" href={file.url} target="_blank" rel="noreferrer">{file.file_name}</a> : file.file_name}</p>)}
      <h2 className="mt-4 font-semibold">Quotations</h2>
      {(row?.quotations ?? []).length === 0 ? <p>No quotations yet.</p> : null}
      {(row?.quotations ?? []).map((quote: { id: string; code: string; status: string; total: number; currency: string }) => (
        <p key={quote.id}>{quote.code} {quote.status} {quote.total} {quote.currency} {canInvoice && quote.status === 'accepted' ? <button className="ml-2 underline" onClick={() => issue(quote.id)}>Issue invoice</button> : null}</p>
      ))}
      {canQuote ? (
        <div className="mt-3 space-y-2 rounded border p-3">
          {lines.map((line, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-4">
              <select className="rounded border p-1" value={line.inventory_item_id ?? ''} onChange={(event) => {
                const item = query.data?.catalog.find((part) => part.id === event.target.value);
                const next = [...lines];
                next[index] = { ...line, inventory_item_id: event.target.value || null, description: item?.name ?? line.description, unit_price: Number(item?.unit_price ?? line.unit_price) };
                setLines(next);
              }}>
                <option value="">Custom line</option>
                {query.data?.catalog.map((part) => <option key={part.id} value={part.id}>{part.name}</option>)}
              </select>
              <input className="rounded border p-1" value={line.description} onChange={(event) => updateLine(lines, setLines, index, { description: event.target.value })} />
              <input className="rounded border p-1" type="number" value={line.quantity} onChange={(event) => updateLine(lines, setLines, index, { quantity: Number(event.target.value) })} />
              <input className="rounded border p-1" type="number" value={line.unit_price} onChange={(event) => updateLine(lines, setLines, index, { unit_price: Number(event.target.value) })} />
            </div>
          ))}
          <button type="button" onClick={() => setLines([...lines, { description: '', quantity: 1, unit_price: 0, inventory_item_id: null }])}>Add line</button>
          <div className="flex gap-2">
            <button className="rounded border px-3 py-1" onClick={() => saveQuote(false)}>Save draft</button>
            {canSendQuote ? <button className="rounded bg-[#0B4F6C] px-3 py-1 text-white" onClick={() => saveQuote(true)}>Send quotation</button> : null}
          </div>
        </div>
      ) : null}
      <h2 className="mt-4 font-semibold">Invoices</h2>
      {(row?.invoices ?? []).length === 0 ? <p>No invoices yet.</p> : (row?.invoices ?? []).map((invoice: { id: string; code: string; status: string; balance: number }) => <p key={invoice.id}>{invoice.code} {invoice.status} balance {invoice.balance}</p>)}
      {canViewMessages ? (
        <>
          <h2 className="mt-4 font-semibold">Messages</h2>
          {query.data?.messages.length === 0 ? <p>No messages yet.</p> : query.data?.messages.map((item) => <p key={item.id}>{item.created_at} · {item.body}</p>)}
        </>
      ) : null}
      {canMessage ? (
        <>
          <textarea className="mt-2 w-full rounded border p-2" value={message} onChange={(event) => setMessage(event.target.value)} />
          <button className="mt-2 rounded bg-[#0B4F6C] px-3 py-1 text-white" onClick={sendMessage}>Send</button>
        </>
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
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <label>Technician
        <select className="ml-2 rounded border p-1" value={technicianId} onChange={(event) => setTechnicianId(event.target.value)}>
          <option value="">Choose</option>
          {technicians.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
        </select>
      </label>
      <label>Supervisor
        <select className="ml-2 rounded border p-1" value={supervisorId} onChange={(event) => setSupervisorId(event.target.value)}>
          <option value="">None</option>
          {supervisors.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
        </select>
      </label>
      <button className="rounded border px-3 py-1" onClick={() => technicianId && onAssign(technicianId, supervisorId)}>Assign</button>
    </div>
  );
}
