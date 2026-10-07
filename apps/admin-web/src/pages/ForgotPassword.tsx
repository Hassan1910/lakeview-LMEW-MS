import React, { useState } from 'react';
import { z } from 'zod';
import { Link } from 'react-router';
import { AuthShell } from '../components/AuthShell';
import { Button, Field, Notice, inputClass, linkClass } from '../components/ui';
import { db } from '../lib/supabase';

const emailSchema = z.string().email('Valid email is required');

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Valid email is required');
      setNotice(null);
      return;
    }
    setFieldError(null);
    setNotice(null);
    setBusy(true);
    const { error } = await db().auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    setNotice(error
      ? { tone: 'error', text: error.message }
      : { tone: 'success', text: 'If that email is registered, a reset link is on its way.' });
  };

  return (
    <AuthShell>
      <form onSubmit={submit} noValidate className="space-y-5">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Reset password</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Enter the email on your account. We will send a link to choose a new password.
          </p>
        </div>
        <Field label="Email" required>
          <input
            id="reset-email"
            className={inputClass}
            type="email"
            autoComplete="username"
            autoFocus
            value={email}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? 'reset-email-error' : undefined}
            onChange={(event) => setEmail(event.target.value)}
          />
          {fieldError ? (
            <span id="reset-email-error" role="alert" className="mt-1 block text-xs font-medium text-red-600 dark:text-red-400">
              {fieldError}
            </span>
          ) : null}
        </Field>
        {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
        <Button type="submit" className="h-11 w-full text-[15px]" disabled={busy}>
          {busy ? 'Sending…' : 'Send reset link'}
        </Button>
        <p className="text-center text-sm">
          <Link to="/login" className={linkClass}>Back to sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
};
