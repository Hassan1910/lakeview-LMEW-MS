import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema, type LoginInput } from '@lmew/shared-types';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

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
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow">
        <h1 className="text-2xl font-semibold text-[#0B4F6C]">Lakeview Marine</h1>
        <p className="text-sm text-slate-600">One sign-in for every staff role and supplier. You will see the modules your role allows.</p>
        <input className="w-full rounded border p-2" placeholder="Email" {...form.register('email')} />
        <input className="w-full rounded border p-2" placeholder="Password" type="password" {...form.register('password')} />
        {form.formState.errors.email ? <p className="text-red-600">{form.formState.errors.email.message}</p> : null}
        {error || authError ? <p className="text-red-600">{error || authError}</p> : null}
        <button className="w-full rounded bg-[#0B4F6C] p-2 text-white" disabled={form.formState.isSubmitting || (loading && !!session)}>{loading && session ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  );
};
