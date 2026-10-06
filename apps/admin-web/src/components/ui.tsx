import React from 'react';

export const inputClass = 'w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900';

export function Page({ title, description, actions, children }: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          {description ? <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      {title ? <h2 className="mb-3 font-semibold">{title}</h2> : null}
      {children}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' };

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const styles = {
    primary: 'bg-[#0B4F6C] text-white hover:bg-[#0a4560]',
    secondary: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }[variant];
  return <button className={`rounded px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`} {...props} />;
}

export function Notice({ tone, children }: { tone: 'error' | 'success' | 'info'; children: React.ReactNode }) {
  if (!children) return null;
  const styles = {
    error: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
    info: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200',
  }[tone];
  return <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded border px-3 py-2 text-sm ${styles}`}>{children}</p>;
}

export function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue' }) {
  const styles = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    red: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
    blue: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
  }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>{children}</span>;
}

export function Table({ head, children }: { head: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
          <tr>{head.map((cell, index) => <th key={index} className="px-3 py-2 font-medium">{cell}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{children}</tbody>
      </table>
    </div>
  );
}

export function errorMessage(error: unknown) {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
  return String(error);
}

export const statusTone = (status: string | null | undefined): 'slate' | 'green' | 'amber' | 'red' | 'blue' => {
  if (!status) return 'slate';
  if (['received', 'paid', 'confirmed', 'completed', 'accepted', 'active'].includes(status)) return 'green';
  if (['cancelled', 'rejected', 'failed', 'suspended'].includes(status)) return 'red';
  if (['draft', 'pending'].includes(status)) return 'amber';
  return 'blue';
};
