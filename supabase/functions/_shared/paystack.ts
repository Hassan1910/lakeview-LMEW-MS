export interface PendingPayment {
  status: string;
  invoice_id: string;
  amount: number;
}

export interface ChargeDecision {
  ok: boolean;
  status?: number;
  error?: string;
  duplicate?: boolean;
  confirm?: boolean;
}

export const MOBILE_PAYSTACK_CALLBACK = "lmew://paystack/callback";
export const MOBILE_PAYSTACK_CANCEL = "lmew://paystack/cancel";

export function paystackChargeDecision(
  existing: PendingPayment | null,
  event: { invoiceId: string; amountMinor: number; currency?: string | null },
): ChargeDecision {
  if (!existing) return { ok: false, status: 400, error: "Unknown reference" };
  if (existing.status === "confirmed") return { ok: true, duplicate: true };
  if (existing.status === "refunded") return { ok: false, status: 409, error: "Payment was refunded" };
  if (existing.status !== "pending" && existing.status !== "failed" && existing.status !== "cancelled") {
    return { ok: false, status: 409, error: "Payment can no longer be confirmed" };
  }
  if (existing.invoice_id !== event.invoiceId) return { ok: false, status: 400, error: "Invoice mismatch" };
  const currency = (event.currency ?? "KES").trim().toUpperCase();
  if (currency !== "KES") return { ok: false, status: 400, error: "Currency mismatch" };
  const paid = Number(event.amountMinor) / 100;
  if (!Number.isFinite(paid) || Math.abs(paid - Number(existing.amount)) > 0.01) {
    return { ok: false, status: 400, error: "Amount mismatch" };
  }
  return { ok: true, confirm: true };
}

export function resolvePaystackCallback(
  requested: unknown,
  configured: string | undefined,
): { ok: true; callback?: string } | { ok: false; error: string } {
  if (requested == null || requested === "") {
    const callback = configured?.trim();
    return { ok: true, callback: callback || undefined };
  }
  if (typeof requested !== "string") return { ok: false, error: "Invalid callback URL" };
  const url = requested.trim();
  if (url === MOBILE_PAYSTACK_CALLBACK) return { ok: true, callback: url };
  const expected = configured?.trim();
  if (expected && url === expected) return { ok: true, callback: url };
  return { ok: false, error: "Callback URL is not allowed" };
}

export type PaystackVerifyAction =
  | { action: "confirm" }
  | { action: "fail"; outcome: "failed" | "cancelled" }
  | { action: "wait" }
  | { action: "unknown" };

export function paystackVerifyAction(status: string | null | undefined): PaystackVerifyAction {
  const value = (status ?? "").trim().toLowerCase();
  if (value === "success") return { action: "confirm" };
  if (value === "failed" || value === "reversed") return { action: "fail", outcome: "failed" };
  if (value === "abandoned") return { action: "fail", outcome: "cancelled" };
  if (value === "pending" || value === "ongoing" || value === "processing" || value === "queued") {
    return { action: "wait" };
  }
  return { action: "unknown" };
}

export interface PaystackTransactionView {
  status?: string | null;
  amount?: number | null;
  paid_at?: string | null;
  channel?: string;
  reference?: string;
  metadata?: { invoice_id?: string | null } | null;
  authorization?: { authorization_code?: string };
}

export type SettleResult =
  | { outcome: "confirmed"; duplicate: boolean }
  | { outcome: "failed" | "cancelled"; change: boolean }
  | { outcome: "processing" }
  | { outcome: "error"; status: number; error: string };

export function settlePaystackCharge(
  existing: PendingPayment | null,
  transaction: PaystackTransactionView | null,
): SettleResult {
  if (!existing) return { outcome: "error", status: 404, error: "Unknown reference" };
  if (existing.status === "confirmed") return { outcome: "confirmed", duplicate: true };
  if (existing.status === "refunded") return { outcome: "error", status: 409, error: "Payment was refunded" };
  if (!transaction) return { outcome: "error", status: 502, error: "Paystack did not return this transaction" };

  const action = paystackVerifyAction(transaction.status);
  if (action.action === "unknown") return { outcome: "error", status: 502, error: "Unrecognized Paystack status" };
  if (action.action === "wait") return { outcome: "processing" };
  if (action.action === "fail") return { outcome: action.outcome, change: existing.status !== action.outcome };

  const invoiceId = transaction.metadata?.invoice_id || existing.invoice_id;
  const decision = paystackChargeDecision(existing, {
    invoiceId,
    amountMinor: Number(transaction.amount),
  });
  if (!decision.ok) {
    return { outcome: "error", status: decision.status ?? 400, error: decision.error ?? "Payment could not be confirmed" };
  }
  if (decision.duplicate) return { outcome: "confirmed", duplicate: true };
  return { outcome: "confirmed", duplicate: false };
}

export function paymentConfirmationPatch(data: PaystackTransactionView) {
  return {
    status: "confirmed" as const,
    paid_at: data.paid_at ?? new Date().toISOString(),
    mpesa_receipt: mpesaReceipt(data),
    raw_payload: data,
  };
}

export function paymentFailurePatch(data: unknown, outcome: "failed" | "cancelled" = "failed") {
  return {
    status: outcome,
    raw_payload: data,
  };
}

export function paystackRefundReference(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const row = data as { transaction_reference?: unknown; transaction?: { reference?: unknown } };
  if (typeof row.transaction_reference === "string" && row.transaction_reference.trim()) return row.transaction_reference.trim();
  const nested = row.transaction?.reference;
  return typeof nested === "string" && nested.trim() ? nested.trim() : null;
}

export function paystackRefundDecision(
  existing: { status: string; amount: number } | null,
  event: { amountMinor: number; currency?: string | null },
): { action: "refund" } | { action: "duplicate" } | { action: "error"; status: number; error: string } {
  if (!existing) return { action: "error", status: 400, error: "Unknown reference" };
  if (existing.status === "refunded") return { action: "duplicate" };
  if (existing.status !== "confirmed") return { action: "error", status: 409, error: "Only a confirmed payment can be refunded" };
  const currency = (event.currency ?? "KES").trim().toUpperCase();
  if (currency !== "KES") return { action: "error", status: 400, error: "Currency mismatch" };
  const refunded = Number(event.amountMinor) / 100;
  if (!Number.isFinite(refunded) || Math.abs(refunded - Number(existing.amount)) > 0.01) {
    return { action: "error", status: 409, error: "Refund amount does not match the payment" };
  }
  return { action: "refund" };
}

export function storedAuthorizationUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const initialize = (raw as { initialize?: { authorization_url?: unknown } }).initialize;
  const url = initialize?.authorization_url;
  return typeof url === "string" && url.startsWith("https://") ? url : null;
}

export type PaystackVerifyFetch =
  | { reachable: true; transaction: PaystackTransactionView | null; missing?: boolean; message?: string }
  | { reachable: false; message: string };

export async function fetchPaystackTransaction(reference: string, secret: string): Promise<PaystackVerifyFetch> {
  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = await response.json().catch(() => null) as { status?: boolean; message?: string; data?: PaystackTransactionView } | null;
    const message = body?.message || "";
    if (response.status === 404 || /not found/i.test(message)) {
      return { reachable: true, transaction: null, missing: true, message: message || "Transaction not found" };
    }
    if (response.status === 429 || response.status >= 500 || !body || !response.ok || body.status !== true || !body.data) {
      return { reachable: false, message: message || "Could not reach Paystack. Try again." };
    }
    return { reachable: true, transaction: body.data };
  } catch {
    return { reachable: false, message: "Could not reach Paystack. Try again." };
  }
}

export type PaystackLookup =
  | { kind: "unreachable" }
  | { kind: "missing" }
  | { kind: "found"; status: string | null | undefined };

export type PendingResumePlan =
  | { action: "resume" }
  | { action: "settle" }
  | { action: "release" }
  | { action: "stop"; error: string };

export function planPendingPaystackResume(input: {
  pendingAmount: number;
  invoiceBalance: number;
  hasCheckoutUrl: boolean;
  lookup: PaystackLookup;
}): PendingResumePlan {
  const amountChanged = Math.abs(Number(input.pendingAmount) - Number(input.invoiceBalance)) > 0.01;
  if (input.lookup.kind === "unreachable") {
    return amountChanged
      ? { action: "stop", error: "This invoice changed while a payment is still open. Try again when Paystack is reachable." }
      : { action: "resume" };
  }
  if (input.lookup.kind === "missing") {
    if (!amountChanged && input.hasCheckoutUrl) return { action: "resume" };
    return { action: "release" };
  }
  const action = paystackVerifyAction(input.lookup.status);
  if (action.action === "confirm") return { action: "settle" };
  if (action.action === "wait") {
    return amountChanged
      ? { action: "stop", error: "A payment for the previous balance is still processing. Wait for it to finish before paying again." }
      : { action: "resume" };
  }
  return { action: "release" };
}

export function mpesaReceipt(data: { channel?: string; reference?: string; authorization?: { authorization_code?: string } }) {
  if (data.channel !== "mobile_money") return null;
  const code = data.authorization?.authorization_code;
  if (!code || code === data.reference) return null;
  return code;
}
