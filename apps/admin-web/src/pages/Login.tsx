import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema, type LoginInput } from '@lmew/shared-types';
import { Lock } from 'lucide-react';
import { Link, Navigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { AuthShell, PasswordField } from '../components/AuthShell';
import { Button, Field, Notice, inputClass, linkClass } from '../components/ui';
import { prefersRememberedSession, setRememberMe } from '../lib/supabase';

export const LoginPage: React.FC = () => {
  const { session, profile, signIn, loading, error: authError } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [remember, setRemember] = useState(prefersRememberedSession);
  const form = useForm<LoginInput>({ resolver: zodResolver(LoginSchema) });
  const emailError = form.formState.errors.email?.message;

  if (!loading && session && profile) return <Navigate to="/" replace />;

  const pending = form.formState.isSubmitting || Boolean(loading && session);

  const submit = form.handleSubmit(async (values) => {
    setRememberMe(remember);
    setError(await signIn(values.email, values.password));
  });

  return (
    <AuthShell>
      <form onSubmit={submit} noValidate className="space-y-5">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Sign in</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            One sign-in for every staff role and supplier. You will see the modules your role allows.
          </p>
        </div>
        <Field label="Email" required>
          <input
            id="email"
            className={inputClass}
            type="email"
            autoComplete="username"
            autoFocus
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? 'email-error' : undefined}
            {...form.register('email')}
          />
          {emailError ? (
            <span id="email-error" role="alert" className="mt-1 block text-xs font-medium text-red-600 dark:text-red-400">
              {emailError}
            </span>
          ) : null}
        </Field>
        <PasswordField
          id="password"
          label="Password"
          required
          autoComplete="current-password"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        <div className="flex items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded-sm accent-lmew-blue-800"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            Remember me
          </label>
          <Link to="/forgot-password" className={`${linkClass} text-sm`}>
            Forgot password?
          </Link>
        </div>
        <Notice tone="error">{error ?? authError}</Notice>
        <Button type="submit" className="h-11 w-full text-[15px]" disabled={pending}>
          <Lock className="h-4 w-4" aria-hidden="true" />
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  );
};
