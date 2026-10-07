import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { AuthShell, PasswordField } from '../components/AuthShell';
import { Button, Notice, linkClass } from '../components/ui';
import { db } from '../lib/supabase';

export const ResetPasswordPage: React.FC = () => {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [nextError, setNextError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (loading) {
    return (
      <AuthShell>
        <p className="text-sm text-slate-500 dark:text-slate-400" role="status">Checking your reset link…</p>
      </AuthShell>
    );
  }

  if (!session) {
    return (
      <AuthShell>
        <div className="space-y-4">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Reset link required</h1>
          <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
            Open the link in your email, or request a new one.
          </p>
          <p className="text-sm">
            <Link to="/forgot-password" className={linkClass}>Request a new link</Link>
          </p>
        </div>
      </AuthShell>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const lengthError = next.length < 8 ? 'Use at least 8 characters.' : null;
    const matchError = next !== confirm ? 'The passwords do not match.' : null;
    setNextError(lengthError);
    setConfirmError(lengthError ? null : matchError);
    setNotice(null);
    if (lengthError || matchError) return;
    setBusy(true);
    const { error } = await db().auth.updateUser({ password: next });
    setBusy(false);
    if (error) {
      setNotice({ tone: 'error', text: error.message });
      return;
    }
    setDone(true);
    setNotice({ tone: 'success', text: 'Password changed.' });
    setNext('');
    setConfirm('');
  };

  return (
    <AuthShell>
      <form onSubmit={submit} noValidate className="space-y-5">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Choose a new password</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Use at least 8 characters. You can sign in with it right away.
          </p>
        </div>
        {done ? null : (
          <>
            <PasswordField
              id="next-password"
              label="New password"
              required
              autoComplete="new-password"
              value={next}
              error={nextError ?? undefined}
              onChange={(event) => setNext(event.target.value)}
            />
            <PasswordField
              id="confirm-password"
              label="Confirm password"
              required
              autoComplete="new-password"
              value={confirm}
              error={confirmError ?? undefined}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </>
        )}
        {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
        {done ? (
          <Button className="h-11 w-full text-[15px]" onClick={() => navigate('/')}>
            Continue
          </Button>
        ) : (
          <Button type="submit" className="h-11 w-full text-[15px]" disabled={busy}>
            {busy ? 'Saving…' : 'Save password'}
          </Button>
        )}
      </form>
    </AuthShell>
  );
};
