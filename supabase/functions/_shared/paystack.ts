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

export function paystackChargeDecision(
  existing: PendingPayment | null,
  event: { invoiceId: string; amountMinor: number },
): ChargeDecision {
  if (!existing) return { ok: false, status: 400, error: "Unknown reference" };
  if (existing.status === "confirmed") return { ok: true, duplicate: true };
  if (existing.invoice_id !== event.invoiceId) return { ok: false, status: 400, error: "Invoice mismatch" };
  const paid = Number(event.amountMinor) / 100;
  if (!Number.isFinite(paid) || Math.abs(paid - Number(existing.amount)) > 0.01) {
    return { ok: false, status: 400, error: "Amount mismatch" };
  }
  return { ok: true, confirm: true };
}

export function mpesaReceipt(data: { channel?: string; reference?: string; authorization?: { authorization_code?: string } }) {
  if (data.channel !== "mobile_money") return null;
  const code = data.authorization?.authorization_code;
  if (!code || code === data.reference) return null;
  return code;
}
