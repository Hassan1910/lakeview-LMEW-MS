import { db } from './supabase';

export type ManageUsersAction = 'list' | 'create' | 'suspend' | 'restore' | 'remove' | 'reset-password' | 'set-password';

export interface AccountInfo {
  last_sign_in_at: string | null;
  banned_until: string | null;
  email_confirmed_at: string | null;
}

// Non-2xx responses surface as FunctionsHttpError with the JSON body still unread on `context`.
export async function manageUsers<T = Record<string, unknown>>(action: ManageUsersAction, body: Record<string, unknown> = {}): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await db().functions.invoke('manage-users', { body: { action, ...body } });
  if (!error) return data?.error ? { data: null, error: String(data.error) } : { data: data as T, error: null };
  const context = (error as { context?: Response }).context;
  if (context && typeof context.json === 'function') {
    try {
      const payload = await context.json();
      if (payload?.error) return { data: null, error: String(payload.error) };
    } catch {
      // fall through to the generic message
    }
  }
  return { data: null, error: error.message };
}
