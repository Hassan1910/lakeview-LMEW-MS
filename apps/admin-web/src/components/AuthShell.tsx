import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { Field, inputClass } from './ui';

export const AuthShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <main className="flex min-h-screen flex-col lg:flex-row">
    <section className="relative overflow-hidden bg-linear-to-br from-lmew-blue-900 via-[#0A3A56] to-[#0B4F6C] px-6 py-8 text-white sm:px-10 lg:flex lg:w-[46%] lg:items-center lg:px-14 lg:py-16">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-lmew-teal-500/20 blur-3xl" aria-hidden="true" />
      <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-32 w-full lg:h-44" viewBox="0 0 800 200" preserveAspectRatio="none" aria-hidden="true">
        <path fill="white" fillOpacity="0.06" d="M0 110c90 50 170 50 260 0s170-50 260 0 170 50 280 0v90H0Z" />
        <path fill="#01BAEF" fillOpacity="0.16" d="M0 146c100 36 180 36 270 0s160-36 260 0 150 28 270 8v46H0Z" />
      </svg>
      <div className="relative max-w-md">
        <div className="flex items-center gap-3">
          <BrandMark className="h-12 w-12 shrink-0 shadow-lg shadow-black/20" decorative />
          <div>
            <p className="font-display text-2xl font-semibold leading-none tracking-tight">Lakeview Marine</p>
            <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7DD3FC]">Engineering Works</p>
          </div>
        </div>
        <p className="mt-8 hidden max-w-sm text-sm leading-6 text-sky-100/85 lg:block">
          One secure sign-in for repairs, vessels, inventory, and finance.
        </p>
      </div>
    </section>
    <section className="flex flex-1 items-start justify-center bg-linear-to-b from-slate-50 to-sky-50/70 px-5 py-8 dark:from-slate-950 dark:to-slate-900 sm:px-8 lg:items-center lg:py-10">
      <div className="auth-rise w-full max-w-104">{children}</div>
    </section>
  </main>
);

type PasswordFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  id: string;
};

export const PasswordField = React.forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { label, error, id, required, className: _className, ...inputProps },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;
  return (
    <Field label={label} required={required}>
      <div className="relative">
        <input
          {...inputProps}
          ref={ref}
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${inputClass} pr-11`}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-md text-slate-500 hover:text-slate-800 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lmew-blue-800 dark:text-slate-400 dark:hover:text-slate-100"
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      {error ? (
        <span id={errorId} role="alert" className="mt-1 block text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : null}
    </Field>
  );
});
