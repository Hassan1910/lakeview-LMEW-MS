import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Permission, Role } from '@lmew/shared-types';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { useConfirm } from '../components/confirm';
import { Badge, Button, Card, Field, Notice, Page, errorMessage, inputClass } from '../components/ui';

const ACTION_ORDER = ['access', 'view', 'view_own', 'create', 'edit', 'edit_own', 'delete', 'approve', 'reject', 'submit', 'assign', 'manage', 'export', 'print', 'view_reports'];
const humanize = (value: string) => value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const slug = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'r_$1').slice(0, 49);

type Message = { tone: 'error' | 'success'; text: string } | null;

export const Roles: React.FC = () => {
  const { can, profile, refresh } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const manage = can('roles.manage');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState({ name: '', description: '', is_active: true });
  const [message, setMessage] = useState<Message>(null);
  const [createForm, setCreateForm] = useState({ name: '', key: '', description: '', copyFrom: '' });
  const [createMessage, setCreateMessage] = useState<Message>(null);
  const [busy, setBusy] = useState(false);

  const data = useQuery({
    queryKey: ['roles-admin'],
    queryFn: async () => {
      const [roles, permissions, grants, members] = await Promise.all([
        db().from('roles').select('*').order('is_system', { ascending: false }).order('name'),
        db().from('permissions').select('*').order('module').order('action'),
        db().from('role_permissions').select('role_id, permission_key'),
        db().from('profiles').select('role_id'),
      ]);
      const failed = roles.error ?? permissions.error ?? grants.error ?? members.error;
      if (failed) throw failed;
      const byRole = new Map<string, Set<string>>();
      for (const row of grants.data ?? []) {
        if (!byRole.has(row.role_id)) byRole.set(row.role_id, new Set());
        byRole.get(row.role_id)!.add(row.permission_key);
      }
      const counts = new Map<string, number>();
      for (const row of members.data ?? []) counts.set(row.role_id, (counts.get(row.role_id) ?? 0) + 1);
      return { roles: (roles.data ?? []) as Role[], permissions: (permissions.data ?? []) as Permission[], byRole, counts };
    },
  });

  const roles = data.data?.roles ?? [];
  const selected = roles.find((role) => role.id === selectedId) ?? roles[0] ?? null;
  const saved = useMemo(() => (selected ? data.data?.byRole.get(selected.id) ?? new Set<string>() : new Set<string>()), [selected, data.data]);
  // Background refetches return new objects with the same content; only real changes may reset unsaved edits.
  const savedSignature = [...saved].sort().join(',');
  const detailsSignature = selected ? `${selected.name}|${selected.description ?? ''}|${selected.is_active}` : '';

  useEffect(() => {
    if (selected) setDraft(new Set(saved));
  }, [selected?.id, savedSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selected) setDetails({ name: selected.name, description: selected.description ?? '', is_active: selected.is_active });
  }, [selected?.id, detailsSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  const matrix = useMemo(() => {
    const modules = new Map<string, Map<string, Permission>>();
    const actions = new Set<string>();
    for (const permission of data.data?.permissions ?? []) {
      if (!modules.has(permission.module)) modules.set(permission.module, new Map());
      modules.get(permission.module)!.set(permission.action, permission);
      actions.add(permission.action);
    }
    const orderedActions = [...actions].sort((a, b) => ACTION_ORDER.indexOf(a) - ACTION_ORDER.indexOf(b));
    return { modules: [...modules.entries()], actions: orderedActions };
  }, [data.data]);

  const isAdminRole = selected?.key === 'administrator';
  const isOwnRole = selected?.id === profile?.role_id;
  const actorIsAdmin = profile?.role === 'administrator';
  const lockedReason = !manage
    ? 'You can view roles but not change them.'
    : isAdminRole
      ? 'The administrator role always holds every permission.'
      : isOwnRole && !actorIsAdmin
        ? 'You cannot change permissions on your own role.'
        : null;
  const grantable = (key: string) => actorIsAdmin || can(key);

  const added = [...draft].filter((key) => !saved.has(key));
  const removed = [...saved].filter((key) => !draft.has(key));
  const dirty = added.length + removed.length > 0;
  const detailsDirty = selected ? details.name !== selected.name || details.description !== (selected.description ?? '') || details.is_active !== selected.is_active : false;

  const toggle = (key: string) => {
    if (lockedReason || !grantable(key)) return;
    const next = new Set(draft);
    if (next.has(key)) next.delete(key); else next.add(key);
    setDraft(next);
  };
  const toggleModule = (perms: Permission[]) => {
    if (lockedReason) return;
    const keys = perms.map((permission) => permission.key).filter(grantable);
    const allOn = keys.every((key) => draft.has(key));
    const next = new Set(draft);
    for (const key of keys) { if (allOn) next.delete(key); else next.add(key); }
    setDraft(next);
  };

  const reload = async () => {
    await queryClient.invalidateQueries({ queryKey: ['roles-admin'] });
    queryClient.invalidateQueries({ queryKey: ['role-options'] });
    await refresh();
  };

  const savePermissions = async () => {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    try {
      if (added.length) {
        const { error } = await db().from('role_permissions').insert(added.map((key) => ({ role_id: selected.id, permission_key: key })));
        if (error) return setMessage({ tone: 'error', text: error.message });
      }
      if (removed.length) {
        const { error } = await db().from('role_permissions').delete().eq('role_id', selected.id).in('permission_key', removed);
        if (error) return setMessage({ tone: 'error', text: error.message });
      }
      setMessage({ tone: 'success', text: `${selected.name}: ${added.length} granted, ${removed.length} revoked. Users with this role get the change on their next page load.` });
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const saveDetails = async () => {
    if (!selected) return;
    if (details.name.trim().length < 2) return setMessage({ tone: 'error', text: 'Role name needs at least two characters.' });
    setBusy(true);
    const { data: rows, error } = await db().from('roles').update({ name: details.name.trim(), description: details.description.trim() || null, is_active: details.is_active }).eq('id', selected.id).select('id');
    setBusy(false);
    if (error) return setMessage({ tone: 'error', text: error.message });
    if (!rows?.length) return setMessage({ tone: 'error', text: 'You do not have permission to edit this role.' });
    setMessage({ tone: 'success', text: 'Role details saved.' });
    await reload();
  };

  const deleteRole = async () => {
    if (!selected || !await confirm({ title: 'Delete role', description: `Delete the ${selected.name} role? This cannot be undone.`, confirmLabel: 'Delete role' })) return;
    setBusy(true);
    const { error } = await db().from('roles').delete().eq('id', selected.id);
    setBusy(false);
    if (error) return setMessage({ tone: 'error', text: error.message });
    setSelectedId(null);
    setMessage({ tone: 'success', text: `${selected.name} deleted.` });
    await reload();
  };

  const createRole = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateMessage(null);
    const key = createForm.key || slug(createForm.name);
    if (createForm.name.trim().length < 2) return setCreateMessage({ tone: 'error', text: 'Enter a role name.' });
    if (!/^[a-z][a-z0-9_]{1,48}$/.test(key)) return setCreateMessage({ tone: 'error', text: 'The key must start with a letter and use lowercase letters, numbers, or underscores.' });
    setBusy(true);
    try {
      const { data: role, error } = await db().from('roles').insert({ key, name: createForm.name.trim(), description: createForm.description.trim() || null }).select('*').single();
      if (error) return setCreateMessage({ tone: 'error', text: error.code === '23505' ? `A role with key "${key}" already exists.` : error.message });
      let copied = 0;
      if (createForm.copyFrom) {
        const source = [...(data.data?.byRole.get(createForm.copyFrom) ?? [])].filter(grantable);
        if (source.length) {
          const { error: copyError } = await db().from('role_permissions').insert(source.map((permission_key) => ({ role_id: role.id, permission_key })));
          if (copyError) setCreateMessage({ tone: 'error', text: `Role created, but copying permissions failed: ${copyError.message}` });
          else copied = source.length;
        }
      }
      if (!createForm.copyFrom || copied) setCreateMessage({ tone: 'success', text: `${role.name} created${copied ? ` with ${copied} permissions` : ''}. Tick its permissions below.` });
      setCreateForm({ name: '', key: '', description: '', copyFrom: '' });
      await reload();
      setSelectedId(role.id);
    } finally {
      setBusy(false);
    }
  };

  const memberCount = selected ? data.data?.counts.get(selected.id) ?? 0 : 0;

  return (
    <Page title="Roles & permissions" description="Decide what each role can see and do. The database enforces these rules on every request.">
      <DataState loading={data.isLoading} error={errorMessage(data.error)} empty={!roles.length} emptyLabel="No roles visible.">
        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="min-w-0 space-y-4">
            <Card title="Roles">
              <ul className="space-y-1" role="listbox" aria-label="Roles">
                {roles.map((role) => (
                  <li key={role.id}>
                    <button
                      role="option"
                      aria-selected={role.id === selected?.id}
                      onClick={() => { setSelectedId(role.id); setMessage(null); }}
                      className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm ${role.id === selected?.id ? 'bg-[#0B4F6C] text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                      <span>{role.name}{role.is_active ? null : <span className="ml-1 text-xs opacity-70">(inactive)</span>}</span>
                      <span className="text-xs opacity-80">{data.data?.counts.get(role.id) ?? 0}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
            {manage ? (
              <Card title="New custom role">
                <form className="space-y-3" onSubmit={createRole}>
                  <Field label="Name"><input className={inputClass} value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="e.g. Yard foreman" /></Field>
                  <Field label="Key" hint={`Used in code and audit logs: ${createForm.key || slug(createForm.name) || '—'}`}><input className={inputClass} value={createForm.key} onChange={(e) => setCreateForm({ ...createForm, key: slug(e.target.value) })} placeholder="Generated from the name" /></Field>
                  <Field label="Description"><input className={inputClass} value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} /></Field>
                  <Field label="Start from">
                    <select className={inputClass} value={createForm.copyFrom} onChange={(e) => setCreateForm({ ...createForm, copyFrom: e.target.value })}>
                      <option value="">No permissions</option>
                      {roles.filter((role) => role.key !== 'administrator').map((role) => <option key={role.id} value={role.id}>Copy {role.name}</option>)}
                    </select>
                  </Field>
                  <Button type="submit" disabled={busy}>Create role</Button>
                  {createMessage ? <Notice tone={createMessage.tone}>{createMessage.text}</Notice> : null}
                </form>
              </Card>
            ) : null}
          </div>

          {selected ? (
            <div className="min-w-0 space-y-4">
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{selected.name}</h2>
                    <p className="text-sm text-slate-500"><span className="font-mono">{selected.key}</span> · {memberCount} {memberCount === 1 ? 'user' : 'users'} · {selected.is_system ? <Badge tone="blue">built-in</Badge> : <Badge>custom</Badge>}</p>
                  </div>
                  {manage && !selected.is_system ? (
                    <Button variant="danger" disabled={busy || memberCount > 0} title={memberCount > 0 ? 'Move every user off this role first' : undefined} onClick={deleteRole}>Delete role</Button>
                  ) : null}
                </div>
                {manage ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_2fr_auto_auto] md:items-end">
                    <Field label="Name"><input className={inputClass} value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} /></Field>
                    <Field label="Description"><input className={inputClass} value={details.description} onChange={(e) => setDetails({ ...details, description: e.target.value })} /></Field>
                    <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" disabled={isAdminRole} checked={details.is_active} onChange={(e) => setDetails({ ...details, is_active: e.target.checked })} /> Active</label>
                    <Button variant="secondary" disabled={busy || !detailsDirty} onClick={saveDetails}>Save details</Button>
                  </div>
                ) : selected.description ? <p className="mt-2 text-sm">{selected.description}</p> : null}
                {!details.is_active && manage && !isAdminRole ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Inactive roles cannot be assigned to new users. Existing users keep their access until moved.</p> : null}
              </Card>

              {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
              {lockedReason ? <Notice tone="info">{lockedReason}</Notice> : null}

              <Card title="Permissions">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800">
                        <th className="sticky left-0 bg-white px-2 py-2 text-left font-medium dark:bg-slate-900">Module</th>
                        {matrix.actions.map((action) => <th key={action} className="px-1 py-2 text-center font-medium">{humanize(action)}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {matrix.modules.map(([module, actions]) => {
                        const perms = [...actions.values()];
                        return (
                          <tr key={module}>
                            <th className="sticky left-0 bg-white px-2 py-1.5 text-left font-medium dark:bg-slate-900">
                              {!lockedReason ? (
                                <button className="text-left hover:underline" title="Toggle the whole row" onClick={() => toggleModule(perms)}>{humanize(module)}</button>
                              ) : humanize(module)}
                            </th>
                            {matrix.actions.map((action) => {
                              const permission = actions.get(action);
                              if (!permission) return <td key={action} />;
                              const checked = isAdminRole || draft.has(permission.key);
                              const changed = !isAdminRole && draft.has(permission.key) !== saved.has(permission.key);
                              return (
                                <td key={action} className={`px-1 py-1.5 text-center ${changed ? 'bg-amber-50 dark:bg-amber-950' : ''}`}>
                                  <input
                                    type="checkbox"
                                    aria-label={permission.key}
                                    title={`${permission.key}: ${permission.description ?? ''}${grantable(permission.key) ? '' : ' (you do not hold this permission)'}`}
                                    checked={checked}
                                    disabled={!!lockedReason || !grantable(permission.key)}
                                    onChange={() => toggle(permission.key)}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!lockedReason ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button disabled={busy || !dirty} onClick={savePermissions}>{busy && dirty ? 'Saving…' : 'Save permissions'}</Button>
                    <Button variant="secondary" disabled={busy || !dirty} onClick={() => setDraft(new Set(saved))}>Discard</Button>
                    <span className="text-sm text-slate-500">{dirty ? `${added.length} to grant, ${removed.length} to revoke` : `${saved.size} permissions granted`}</span>
                  </div>
                ) : null}
              </Card>
            </div>
          ) : null}
        </div>
      </DataState>
    </Page>
  );
};
