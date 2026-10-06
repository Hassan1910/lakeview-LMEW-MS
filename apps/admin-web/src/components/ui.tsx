import React from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { statusLabel } from '../lib/format';

export const inputClass = 'w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0B4F6C] focus:ring-2 focus:ring-[#0B4F6C]/20 disabled:cursor-not-allowed disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900';

export const linkClass = 'font-medium text-[#0B4F6C] hover:underline dark:text-sky-300';

export const tdClass = 'px-3 py-2.5 align-middle text-slate-700 dark:text-slate-200';

type HeadCell = React.ReactNode | { content: React.ReactNode; className?: string };

function headParts(cell: HeadCell) {
  if (typeof cell === 'object' && cell !== null && 'content' in cell) {
    return { content: cell.content, className: cell.className ?? '' };
  }
  return { content: cell, className: '' };
}

export function Page({ title, description, actions, children }: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">{title}</h1>
          {description ? <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Card({ title, children, className = '', action }: { title?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      {title || action ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title ? <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function Field({ label, children, hint, required }: { label: string; children: React.ReactNode; hint?: string; required?: boolean }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' };

export function Button({ variant = 'primary', className = '', type = 'button', ...props }: ButtonProps) {
  const styles = {
    primary: 'border border-[#0B4F6C] bg-[#0B4F6C] text-white hover:bg-[#083A50] focus-visible:outline-[#0B4F6C]',
    secondary: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-[#0B4F6C] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
    danger: 'border border-red-700 bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-700',
  }[variant];
  return (
    <button
      type={type}
      className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Notice({ tone, children }: { tone: 'error' | 'success' | 'info' | 'warning'; children: React.ReactNode }) {
  if (!children) return null;
  const styles = {
    error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
    info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100',
    warning: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100',
  }[tone];
  return <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-md border px-3 py-2 text-sm ${styles}`}>{children}</p>;
}

export function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue' }) {
  const styles = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    green: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    amber: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    red: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200',
    blue: 'bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  }[tone];
  return <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${styles}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  return <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>;
}

export function Table({ head, children }: { head: HeadCell[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950">
          <tr>
            {head.map((cell, index) => {
              const item = headParts(cell);
              return <th key={index} className={`px-3 py-2 font-medium ${item.className}`}>{item.content}</th>;
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{children}</tbody>
      </table>
    </div>
  );
}

export function Kpi({ label, value, to, hint }: { label: string; value: React.ReactNode; to?: string; hint?: string }) {
  const body = (
    <>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </>
  );
  const className = 'block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900';
  if (to) return <Link to={to} className={className}>{body}</Link>;
  return <div className={className}>{body}</div>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200 dark:bg-slate-800 ${className}`} />;
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}
    </div>
  );
}

export function SearchField({ value, onChange, placeholder = 'Search', label }: { value: string; onChange: (value: string) => void; placeholder?: string; label?: string }) {
  return (
    <label className="relative block w-full max-w-sm">
      <span className="sr-only">{label ?? placeholder}</span>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`${inputClass} pl-8`} />
    </label>
  );
}

export function Pagination({ page, pageCount, total, onPage }: { page: number; pageCount: number; total: number; onPage: (page: number) => void }) {
  if (total === 0 || pageCount <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
      <p>Page {page} of {pageCount} · {total} records</p>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button variant="secondary" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
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
  if (['received', 'paid', 'confirmed', 'completed', 'accepted', 'active', 'shipped'].includes(status)) return 'green';
  if (['cancelled', 'rejected', 'failed', 'suspended', 'refunded', 'no_show'].includes(status)) return 'red';
  if (['draft', 'pending', 'quotation_pending', 'awaiting_approval', 'awaiting_spare_parts'].includes(status)) return 'amber';
  return 'blue';
};
