import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Role } from '@lmew/shared-types';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { AccountInfo, manageUsers } from '../lib/manageUsers';
import { Badge, Button, Card, Field, Notice, Page, Table, errorMessage, inputClass } from '../components/ui';

type Message = { tone: 'error' | 'success'; text: string } | null;
interface UserRow { id: string; full_name: string; email: string | null; phone: string | null; role: string; role_id: string; is_active: boolean; created_at: string }

const blankCreate = { full_name: '', email: '', phone: '', role_id: '', method: 'invite' as 'invite' | 'password', password: '' };

export const Users: React.FC = () => {
  const { can, profile } = useAuth();
  const queryClient = useQueryClient();
  const manage = can('users.manage');
  const actorIsAdmin = profile?.role === 'administrator';
  const [roleFilter, setRoleFilter] = useState('staff');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<Message>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(blankCreate);
  const [createMessage, setCreateMessage] = useState<Message>(null);
  const [passwordFor, setPasswordFor] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const roles = useQuery({
    queryKey: ['role-options'],
    queryFn: async () => {
      const { data, error } = await db().from('roles').select('*').order('name');
      if (error) throw error;
      return (data ?? []) as Role[];
    },
  });
  const users = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await db().from('profiles').select('id, full_name, email, phone, role, role_id, is_active, created_at').order('full_name');
      if (error) throw error;
      return (data ?? []) as UserRow[];
    },
  });
  const accounts = useQuery({
    queryKey: ['user-accounts'],
    queryFn: async () => {
      const { data, error } = await manageUsers<{ accounts: Record<string, AccountInfo> }>('list');
      if (error) throw new Error(error);
      return data?.accounts ?? {};
    },
  });

  const roleById = useMemo(() => new Map((roles.data ?? []).map((role) => [role.id, role])), [roles.data]);
  const assignable = (roles.data ?? []).filter((role) => role.is_active && (actorIsAdmin || role.key !== 'administrator'));

  const rows = (users.data ?? []).filter((user) => {
    if (roleFilter === 'staff' && user.role === 'customer') return false;
    if (roleFilter !== 'staff' && roleFilter !== 'all' && user.role_id !== roleFilter) return false;
    if (statusFilter === 'active' && !user.is_active) return false;
    if (statusFilter === 'suspended' && user.is_active) return false;
    if (search && !`${user.full_name} ${user.email ?? ''} ${user.phone ?? ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['user-accounts'] });
    queryClient.invalidateQueries({ queryKey: ['roles-admin'] });
  };

  const canTouch = (user: UserRow) => manage && user.id !== profile?.id && (actorIsAdmin || user.role !== 'administrator');

  const changeRole = async (user: UserRow, roleId: string) => {
    const next = roleById.get(roleId);
    if (!next || roleId === user.role_id) return;
    if (!window.confirm(`Change ${user.full_name} from ${roleById.get(user.role_id)?.name ?? user.role} to ${next.name}?`)) return;
    setBusy(user.id);
    setMessage(null);
    const { data, error } = await db().from('profiles').update({ role_id: roleId }).eq('id', user.id).select('id');
    setBusy(null);
    if (error) setMessage({ tone: 'error', text: error.message });
    else if (!data?.length) setMessage({ tone: 'error', text: 'You do not have permission to change this account.' });
    else setMessage({ tone: 'success', text: `${user.full_name} is now ${next.name}.` });
    invalidate();
  };

  const act = async (user: UserRow, action: 'suspend' | 'restore' | 'remove' | 'reset-password', done: string) => {
    if (action === 'remove' && !window.confirm(`Permanently remove ${user.full_name}'s account? This cannot be undone.`)) return;
    if (action === 'suspend' && !window.confirm(`Suspend ${user.full_name}? They will be signed out and blocked from signing in.`)) return;
    setBusy(user.id);
    setMessage(null);
    const { error } = await manageUsers(action, { user_id: user.id, redirect_to: `${window.location.origin}/login` });
    setBusy(null);
    setMessage(error ? { tone: 'error', text: error } : { tone: 'success', text: done });
    invalidate();
  };

  const setPassword = async (user: UserRow) => {
    if (newPassword.length < 8) return setMessage({ tone: 'error', text: 'Use at least 8 characters.' });
    setBusy(user.id);
    const { error } = await manageUsers('set-password', { user_id: user.id, password: newPassword });
    setBusy(null);
    setMessage(error ? { tone: 'error', text: error } : { tone: 'success', text: `Password set for ${user.full_name}. Share it with them securely.` });
    if (!error) { setPasswordFor(null); setNewPassword(''); }
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateMessage(null);
    if (createForm.full_name.trim().length < 2) return setCreateMessage({ tone: 'error', text: 'Enter the full name.' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(createForm.email.trim())) return setCreateMessage({ tone: 'error', text: 'Enter a valid email address.' });
    if (!createForm.role_id) return setCreateMessage({ tone: 'error', text: 'Choose a role.' });
    if (createForm.method === 'password' && createForm.password.length < 8) return setCreateMessage({ tone: 'error', text: 'The password needs at least 8 characters.' });
    setBusy('create');
    const { data, error } = await manageUsers<{ invited: boolean }>('create', {
      full_name: createForm.full_name.trim(),
      email: createForm.email.trim(),
      phone: createForm.phone.trim() || null,
      role_id: createForm.role_id,
      password: createForm.method === 'password' ? createForm.password : null,
      redirect_to: `${window.location.origin}/login`,
    });
    setBusy(null);
    if (error) return setCreateMessage({ tone: 'error', text: error });
    setCreateMessage({ tone: 'success', text: data?.invited ? `Invitation sent to ${createForm.email.trim()}.` : `${createForm.full_name.trim()} can sign in now.` });
    setCreateForm(blankCreate);
    invalidate();
  };

  const status = (user: UserRow) => {
    const account = accounts.data?.[user.id];
    if (!user.is_active) return <Badge tone="red">suspended</Badge>;
    if (account && !account.email_confirmed_at) return <Badge tone="amber">invited</Badge>;
    return <Badge tone="green">active</Badge>;
  };

  return (
    <Page
      title="Users"
      description="Staff, supplier, and customer accounts. Roles decide what each account can do."
      actions={manage ? <Button onClick={() => { setShowCreate(!showCreate); setCreateMessage(null); }}>{showCreate ? 'Close' : 'New account'}</Button> : null}
    >
      {manage && showCreate ? (
        <Card title="Create an account">
          <form className="grid gap-3 md:grid-cols-3" onSubmit={create}>
            <Field label="Full name"><input className={inputClass} value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} /></Field>
            <Field label="Email"><input className={inputClass} type="email" autoComplete="off" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} /></Field>
            <Field label="Phone"><input className={inputClass} value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} /></Field>
            <Field label="Role">
              <select className={inputClass} value={createForm.role_id} onChange={(e) => setCreateForm({ ...createForm, role_id: e.target.value })}>
                <option value="">Choose a role…</option>
                {assignable.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
              </select>
            </Field>
            <Field label="Sign-in setup">
              <select className={inputClass} value={createForm.method} onChange={(e) => setCreateForm({ ...createForm, method: e.target.value as 'invite' | 'password' })}>
                <option value="invite">Email an invitation link</option>
                <option value="password">Set a password now</option>
              </select>
            </Field>
            {createForm.method === 'password' ? (
              <Field label="Temporary password" hint="At least 8 characters. Ask them to change it from My profile."><input className={inputClass} type="password" autoComplete="new-password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} /></Field>
            ) : <div />}
            <div className="md:col-span-3"><Button type="submit" disabled={busy === 'create'}>{busy === 'create' ? 'Creating…' : 'Create account'}</Button></div>
          </form>
          {createMessage ? <div className="mt-3"><Notice tone={createMessage.tone}>{createMessage.text}</Notice></div> : null}
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <input className={`${inputClass} max-w-xs`} placeholder="Search name, email, or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Filter by role" className={`${inputClass} w-48`} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="staff">All except customers</option>
          <option value="all">Everyone</option>
          {(roles.data ?? []).map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
        </select>
        <select aria-label="Filter by status" className={`${inputClass} w-36`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="all">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      {accounts.error ? <Notice tone="info">Sign-in details are unavailable: {errorMessage(accounts.error)}</Notice> : null}

      <DataState loading={users.isLoading || roles.isLoading} error={errorMessage(users.error ?? roles.error)} empty={!rows.length} emptyLabel="No accounts match these filters.">
        <Table head={['Name', 'Role', 'Status', 'Last sign-in', '']}>
          {rows.map((user) => {
            const account = accounts.data?.[user.id];
            const editable = canTouch(user);
            const role = roleById.get(user.role_id);
            return (
              <React.Fragment key={user.id}>
                <tr className={busy === user.id ? 'opacity-60' : ''}>
                  <td className="px-3 py-2">
                    <span className="font-medium">{user.full_name}</span>{user.id === profile?.id ? <span className="ml-1 text-xs text-slate-500">(you)</span> : null}
                    <span className="block text-xs text-slate-500">{user.email ?? 'no email'}{user.phone ? ` · ${user.phone}` : ''}</span>
                  </td>
                  <td className="px-3 py-2">
                    {editable ? (
                      <select aria-label={`Role for ${user.full_name}`} className={`${inputClass} w-48`} value={user.role_id} disabled={busy === user.id} onChange={(e) => changeRole(user, e.target.value)}>
                        {[...(role && !assignable.includes(role) ? [role] : []), ...assignable].map((option) => <option key={option.id} value={option.id} disabled={!assignable.includes(option)}>{option.name}</option>)}
                      </select>
                    ) : role?.name ?? user.role}
                  </td>
                  <td className="px-3 py-2">{status(user)}</td>
                  <td className="px-3 py-2 text-xs">{account?.last_sign_in_at ? new Date(account.last_sign_in_at).toLocaleString() : accounts.isLoading ? '…' : 'Never'}</td>
                  <td className="px-3 py-2">
                    {editable ? (
                      <div className="flex flex-wrap justify-end gap-1">
                        {user.is_active
                          ? <Button variant="secondary" disabled={busy === user.id} onClick={() => act(user, 'suspend', `${user.full_name} is suspended.`)}>Suspend</Button>
                          : <Button variant="secondary" disabled={busy === user.id} onClick={() => act(user, 'restore', `${user.full_name} is restored.`)}>Restore</Button>}
                        <Button variant="secondary" disabled={busy === user.id || !user.email} onClick={() => act(user, 'reset-password', `Password reset email sent to ${user.email}.`)}>Reset password</Button>
                        <Button variant="secondary" disabled={busy === user.id} onClick={() => { setPasswordFor(passwordFor === user.id ? null : user.id); setNewPassword(''); }}>Set password</Button>
                        <Button variant="danger" disabled={busy === user.id} onClick={() => act(user, 'remove', `${user.full_name}'s account was removed.`)}>Remove</Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
                {passwordFor === user.id ? (
                  <tr>
                    <td colSpan={5} className="bg-slate-50 px-3 py-2 dark:bg-slate-950">
                      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void setPassword(user); }}>
                        <Field label={`New password for ${user.full_name}`}><input autoFocus className={`${inputClass} w-64`} type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></Field>
                        <Button type="submit" disabled={busy === user.id}>Save password</Button>
                        <Button type="button" variant="secondary" onClick={() => setPasswordFor(null)}>Cancel</Button>
                      </form>
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </Table>
      </DataState>
    </Page>
  );
};
