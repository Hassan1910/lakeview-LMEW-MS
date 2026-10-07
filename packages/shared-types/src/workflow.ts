export type StockMovementKind = 'in' | 'out' | 'adjustment' | 'return';

export function workOrderAssignAction(hasOpenJob: boolean): 'update' | 'insert' {
  return hasOpenJob ? 'update' : 'insert';
}

export function quotationSaveAction(hasDraft: boolean): 'update' | 'insert' {
  return hasDraft ? 'update' : 'insert';
}

export function paymentRoom(balance: number, pendingAmounts: number[], amount: number):
  | { ok: true; available: number }
  | { ok: false; available: number; message: string } {
  const reserved = pendingAmounts.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  const available = Math.round((Number(balance) - reserved) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, available, message: 'Enter an amount greater than zero.' };
  }
  if (amount > available + 0.009) {
    if (reserved > 0.009) {
      const left = Math.max(available, 0).toFixed(2);
      return {
        ok: false,
        available,
        message: available > 0.009
          ? `A payment is already waiting for confirmation, so only KES ${left} can be recorded.`
          : 'A payment is already waiting for confirmation. This invoice cannot take another payment until that one is confirmed or cancelled.',
      };
    }
    return { ok: false, available, message: 'This invoice has no balance due.' };
  }
  return { ok: true, available };
}

export function stockDelta(type: StockMovementKind, quantity: number) {
  return type === 'out' ? -quantity : quantity;
}

/** Mirrors stock movement insert, edit, and delete. `before` is the row being replaced or removed. */
export function stockOnHandAfter(
  onHand: number,
  before: { type: StockMovementKind; quantity: number } | null,
  after: { type: StockMovementKind; quantity: number } | null,
) {
  let next = onHand;
  if (before) next -= stockDelta(before.type, before.quantity);
  if (after) next += stockDelta(after.type, after.quantity);
  return next;
}

export function purchaseOrderReceiveProblem(lines: { inventoryItemId: string | null }[]): string | null {
  if (!lines.length) return 'Purchase order has no lines';
  if (lines.some((line) => !line.inventoryItemId)) {
    return 'Every purchase order line needs an inventory item before it can be received';
  }
  return null;
}

export type ServiceStep =
  | 'request_received'
  | 'inspection_in_progress'
  | 'quotation_pending'
  | 'quotation_sent'
  | 'awaiting_approval'
  | 'awaiting_spare_parts'
  | 'under_repair'
  | 'testing'
  | 'completed'
  | 'cancelled';

/** Status to write when a quotation is accepted. Null means leave the request where it is. */
export function quotationAcceptTarget(status: ServiceStep, openJobs: number, finishedJobs: number): ServiceStep | null {
  if (!['quotation_pending', 'quotation_sent', 'awaiting_approval', 'awaiting_spare_parts'].includes(status)) return null;
  if (openJobs === 0 && finishedJobs > 0) return 'testing';
  return 'under_repair';
}

export function sessionSurvivesProfileError(hadSession: boolean, message: string) {
  return hadSession && /network request failed|failed to fetch|network error|timeout|offline|could not connect/i.test(message);
}
