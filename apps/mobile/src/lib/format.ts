export function labelize(value: string | null | undefined) {
  if (!value) return '';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function money(amount: number | string | null | undefined, currency = 'KES') {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '—';
  return `${currency} ${value.toFixed(2)}`;
}

export function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (!message) return 'Something went wrong. Try again.';
  if (/network request failed|failed to fetch|network error|timeout|offline|could not connect/i.test(message)) {
    return 'No connection. Check your internet and try again.';
  }
  if (/jwt expired|invalid jwt|not authenticated|session/i.test(message)) {
    return 'Your session expired. Sign in again.';
  }
  return message;
}

export function safeFileName(name: string | null | undefined) {
  const base = (name ?? 'photo.jpg').split(/[/\\]/).pop() ?? 'photo.jpg';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 80);
  return cleaned || 'photo.jpg';
}

export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const PAYABLE = new Set(['issued', 'partially_paid', 'overdue']);

export function isPayableStatus(status: string | null | undefined) {
  return Boolean(status && PAYABLE.has(status));
}

export async function readFunctionError(
  error: { message?: string; context?: { json?: () => Promise<{ error?: string }> } } | null,
  data: { error?: string } | null,
) {
  if (data?.error) return data.error;
  const context = error?.context;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.json();
      if (body?.error) return body.error;
    } catch {
      // The body can only be read once; fall through to the generic message.
    }
  }
  return friendlyError(error?.message ?? 'Request failed');
}
