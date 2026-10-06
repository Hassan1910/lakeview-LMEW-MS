import React, { useEffect, useState } from 'react';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { Badge, Button, Card, Field, Notice, Page, inputClass } from '../components/ui';

export const Profile: React.FC = () => {
  const { profile, role, permissions, refresh } = useAuth();
  const [form, setForm] = useState({ fullName: '', phone: '' });
  const [password, setPassword] = useState({ next: '', confirm: '' });
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    setForm({ fullName: profile?.full_name ?? '', phone: profile?.phone ?? '' });
  }, [profile]);

  if (!profile) return <p className="p-6 text-slate-500">Loading…</p>;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.fullName.trim().length < 2) return setMessage({ tone: 'error', text: 'Enter your full name.' });
    const { error } = await db().from('profiles').update({ full_name: form.fullName.trim(), phone: form.phone.trim() || null }).eq('id', profile.id);
    setMessage(error ? { tone: 'error', text: error.message } : { tone: 'success', text: 'Profile saved.' });
    if (!error) await refresh();
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.next.length < 8) return setPasswordMessage({ tone: 'error', text: 'Use at least 8 characters.' });
    if (password.next !== password.confirm) return setPasswordMessage({ tone: 'error', text: 'The passwords do not match.' });
    const { error } = await db().auth.updateUser({ password: password.next });
    setPasswordMessage(error ? { tone: 'error', text: error.message } : { tone: 'success', text: 'Password changed.' });
    if (!error) setPassword({ next: '', confirm: '' });
  };

  const modules = [...new Set([...permissions].map((key) => key.split('.')[0]))].filter((key) => key !== 'portal').sort();

  return (
    <Page title="My profile" description={profile.email ?? undefined}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Details">
          <form className="space-y-3" onSubmit={save}>
            <Field label="Full name"><input className={inputClass} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
            <Field label="Phone"><input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Button type="submit">Save</Button>
            {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
          </form>
        </Card>
        <Card title="Change password">
          <form className="space-y-3" onSubmit={changePassword}>
            <Field label="New password"><input className={inputClass} type="password" autoComplete="new-password" value={password.next} onChange={(e) => setPassword({ ...password, next: e.target.value })} /></Field>
            <Field label="Confirm new password"><input className={inputClass} type="password" autoComplete="new-password" value={password.confirm} onChange={(e) => setPassword({ ...password, confirm: e.target.value })} /></Field>
            <Button type="submit">Change password</Button>
            {passwordMessage ? <Notice tone={passwordMessage.tone}>{passwordMessage.text}</Notice> : null}
          </form>
        </Card>
      </div>
      <Card title="Access">
        <p className="text-sm">Role <Badge tone="blue">{role?.name ?? profile.role}</Badge> {profile.is_active ? <Badge tone="green">active</Badge> : <Badge tone="red">suspended</Badge>}</p>
        {role?.description ? <p className="mt-2 text-sm text-slate-500">{role.description}</p> : null}
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">You can work with: {modules.length ? modules.map((key) => key.replace(/_/g, ' ')).join(', ') : 'your own records only'}.</p>
        <p className="mt-1 text-xs text-slate-500">An administrator controls these permissions under Roles & permissions.</p>
      </Card>
    </Page>
  );
};
