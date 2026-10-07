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

export function localDayBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function todayHeading(date = new Date()) {
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Calendar dates (YYYY-MM-DD) stay on that day in the local timezone. */
export function formatDateOnly(value: string | null | undefined) {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return formatWhen(value, 'date');
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatWhen(value: string | null | undefined, style: 'date' | 'time' | 'datetime' | 'relative' = 'datetime') {
  if (!value) return '';
  const date = parseDate(value);
  if (!date) return '';
  if (style === 'date') return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  if (style === 'time') return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (style === 'relative') {
    const minutes = Math.round((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

export function dayLabel(value: string) {
  const date = parseDate(value);
  if (!date) return value.slice(0, 10);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((start.getTime() - day.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const sameYear = date.getFullYear() === start.getFullYear();
  return date.toLocaleDateString(undefined, sameYear
    ? { weekday: 'short', month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
}

const REQUEST_IN_PROGRESS = new Set(['under_repair', 'testing']);

export function requestBucket(status: string): 'pending' | 'in_progress' | 'completed' | 'cancelled' {
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  if (REQUEST_IN_PROGRESS.has(status)) return 'in_progress';
  return 'pending';
}

export function invoiceStatusLabel(status: string) {
  if (status === 'paid') return 'Paid';
  if (status === 'overdue') return 'Overdue';
  if (status === 'issued' || status === 'partially_paid') return 'Pending';
  return labelize(status);
}

export function mapsSearchUrl(location: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

const PAYABLE = new Set(['issued', 'partially_paid', 'overdue']);

export function isPayableStatus(status: string | null | undefined) {
  return Boolean(status && PAYABLE.has(status));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function recordFromJson(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return asRecord(value);
}

export async function readFunctionBody(context: unknown): Promise<Record<string, unknown> | null> {
  const direct = recordFromJson(context);
  if (direct && (typeof direct.error === 'string' || typeof direct.outcome === 'string')) return direct;
  if (!context || typeof context !== 'object') return direct;

  const response = context as {
    clone?: () => unknown;
    json?: () => Promise<unknown>;
    text?: () => Promise<string>;
    _bodyText?: unknown;
    _bodyInit?: unknown;
  };
  for (const raw of [response._bodyText, response._bodyInit]) {
    const parsed = recordFromJson(raw);
    if (parsed) return parsed;
  }

  const readers: unknown[] = [];
  if (typeof response.clone === 'function') {
    try {
      readers.push(response.clone());
    } catch {
      // Some React Native responses cannot be cloned.
    }
  }
  readers.push(context);

  for (const reader of readers) {
    if (!reader || typeof reader !== 'object') continue;
    const candidate = reader as { json?: () => Promise<unknown>; text?: () => Promise<string> };
    if (typeof candidate.json === 'function') {
      try {
        const parsed = recordFromJson(await candidate.json());
        if (parsed) return parsed;
        continue;
      } catch {
        // The body can only be read once. Try the text body next.
      }
    }
    if (typeof candidate.text === 'function') {
      try {
        const parsed = recordFromJson(await candidate.text());
        if (parsed) return parsed;
      } catch {
        // Keep looking at the next reader.
      }
    }
  }
  return direct;
}

export async function readFunctionError(
  error: { message?: string; context?: unknown } | null,
  data: { error?: string } | null,
) {
  if (data?.error) return data.error;
  const body = await readFunctionBody(error?.context);
  if (typeof body?.error === 'string' && body.error) return body.error;
  return friendlyError(error?.message ?? 'Request failed');
}
