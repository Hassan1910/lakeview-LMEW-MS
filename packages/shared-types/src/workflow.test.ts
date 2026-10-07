import { describe, expect, it } from 'vitest';
import {
  paymentRoom,
  purchaseOrderReceiveProblem,
  quotationAcceptTarget,
  quotationSaveAction,
  sessionSurvivesProfileError,
  stockOnHandAfter,
  workOrderAssignAction,
} from './workflow';

describe('request writes', () => {
  it('updates an open job instead of inserting another', () => {
    expect(workOrderAssignAction(true)).toBe('update');
    expect(workOrderAssignAction(false)).toBe('insert');
  });

  it('updates an existing draft instead of inserting another quotation', () => {
    expect(quotationSaveAction(true)).toBe('update');
    expect(quotationSaveAction(false)).toBe('insert');
  });
});

describe('customer payment room', () => {
  it('rejects a second payment while an earlier one is still pending', () => {
    const room = paymentRoom(1500, [1500], 1500);
    expect(room.ok).toBe(false);
    if (!room.ok) expect(room.message).toMatch(/waiting for confirmation/);
  });

  it('allows a payment that fits beside a smaller pending amount', () => {
    expect(paymentRoom(1500, [500], 1000)).toEqual({ ok: true, available: 1000 });
  });
});

describe('paths that were not exercised', () => {
  it('edits and deletes stock by reversing the previous movement', () => {
    expect(stockOnHandAfter(0, null, { type: 'in', quantity: 10 })).toBe(10);
    expect(stockOnHandAfter(10, { type: 'in', quantity: 10 }, { type: 'in', quantity: 4 })).toBe(4);
    expect(stockOnHandAfter(4, { type: 'in', quantity: 4 }, null)).toBe(0);
    expect(stockOnHandAfter(7, { type: 'out', quantity: 3 }, null)).toBe(10);
  });

  it('refuses to receive a purchase order line that has no inventory item', () => {
    expect(purchaseOrderReceiveProblem([{ inventoryItemId: null }])).toMatch(/needs an inventory item/);
    expect(purchaseOrderReceiveProblem([])).toMatch(/no lines/);
    expect(purchaseOrderReceiveProblem([{ inventoryItemId: 'item-1' }])).toBeNull();
  });

  it('leaves a finished job in testing when the quotation is accepted', () => {
    expect(quotationAcceptTarget('awaiting_approval', 0, 1)).toBe('testing');
    expect(quotationAcceptTarget('testing', 0, 1)).toBeNull();
    expect(quotationAcceptTarget('awaiting_approval', 1, 0)).toBe('under_repair');
  });

  it('keeps a signed-in session when the profile request loses the network', () => {
    expect(sessionSurvivesProfileError(true, 'Network request failed')).toBe(true);
    expect(sessionSurvivesProfileError(false, 'Network request failed')).toBe(false);
    expect(sessionSurvivesProfileError(true, 'Invalid login credentials')).toBe(false);
  });
});
