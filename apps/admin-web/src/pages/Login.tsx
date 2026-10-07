import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema, type LoginInput } from '@lmew/shared-types';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Button, Field, Notice, inputClass } from '../components/ui';

export const LoginPage: React.FC = () => {
  const { session, profile, signIn, loading, error: authError } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginInput>({ resolver: zodResolver(LoginSchema) });

  if (!loading && session && profile) return <Navigate to="/" replace />;

  const submit = form.handleSubmit(async (values) => {
    setError(await signIn(values.email, values.password));
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Lakeview Marine</p>
          <h1 className="mt-1 text-lg font-semibold text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">One sign-in for every staff role and supplier. You will see the modules your role allows.</p>
        </div>
        <Field label="Email" required>
          <input className={inputClass} type="email" autoComplete="username" {...form.register('email')} />
        </Field>
        <Field label="Password" required>
          <input className={inputClass} type="password" autoComplete="current-password" {...form.register('password')} />
        </Field>
        <Notice tone="error">{form.formState.errors.email?.message ?? form.formState.errors.password?.message ?? error ?? authError}</Notice>
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting || (loading && !!session)}>{form.formState.isSubmitting || (loading && session) ? 'Signing in…' : 'Sign in'}</Button>
      </form>
    </main>
  );
};
