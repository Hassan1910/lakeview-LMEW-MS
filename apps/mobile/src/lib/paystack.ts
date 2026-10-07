import { PaystackVerifySchema } from '@lmew/shared-types';
import { db } from './db';
import { friendlyError, readFunctionBody, readFunctionError } from './format';

export type PaystackOutcome = 'confirmed' | 'failed' | 'cancelled' | 'processing' | 'error';

export type PaystackVerifyResult = {
  outcome: PaystackOutcome;
  reference: string;
  invoice_id?: string;
  authorization_url?: string | null;
  amount?: number;
  message?: string;
};

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export function paystackReferenceFromParams(reference?: string | string[], trxref?: string | string[]) {
  return firstParam(reference).trim() || firstParam(trxref).trim();
}

function numericAmount(value: unknown) {
  const amount = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(amount) ? amount : undefined;
}

async function invokeBody(
  error: { message?: string; context?: unknown } | null,
  data: Record<string, unknown> | null,
) {
  if (data) return data;
  return readFunctionBody(error?.context);
}

export async function verifyPaystackPayment(reference: string, options?: { observe?: boolean }): Promise<PaystackVerifyResult> {
  const parsed = PaystackVerifySchema.safeParse({
    reference,
    observe: options?.observe === true ? true : undefined,
  });
  if (!parsed.success) return { outcome: 'error', reference, message: 'Missing payment reference' };
  try {
    const { data, error } = await db().functions.invoke('verify-paystack-payment', { body: parsed.data });
    const body = await invokeBody(error, data && typeof data === 'object' ? data as Record<string, unknown> : null);
    const outcome = body?.outcome;
    const invoiceId = typeof body?.invoice_id === 'string' ? body.invoice_id : undefined;
    const authorizationUrl = typeof body?.authorization_url === 'string' ? body.authorization_url : null;
    const amount = numericAmount(body?.amount);
    const resolvedReference = typeof body?.reference === 'string' ? body.reference : reference;
    if (outcome === 'confirmed' || outcome === 'failed' || outcome === 'cancelled' || outcome === 'processing') {
      return { outcome, reference: resolvedReference, invoice_id: invoiceId, authorization_url: authorizationUrl, amount };
    }
    return {
      outcome: 'error',
      reference: resolvedReference,
      invoice_id: invoiceId,
      authorization_url: authorizationUrl,
      message: await readFunctionError(error, body && typeof body.error === 'string' ? { error: body.error } : data),
    };
  } catch (err) {
    return { outcome: 'error', reference, message: friendlyError(err) };
  }
}
