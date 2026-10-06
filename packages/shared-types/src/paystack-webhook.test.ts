import { paystackChargeDecision, mpesaReceipt } from '../../../supabase/functions/_shared/paystack';
import { describe, expect, it } from 'vitest';

describe('paystack webhook decision', () => {
  const pending = { status: 'pending', invoice_id: 'inv-1', amount: 1500 };

  it('rejects an unknown reference instead of inserting from metadata', () => {
    expect(paystackChargeDecision(null, { invoiceId: 'inv-1', amountMinor: 150000 })).toMatchObject({
      ok: false,
      error: 'Unknown reference',
    });
  });

  it('confirms only when the amount and invoice match the pending row', () => {
    expect(paystackChargeDecision(pending, { invoiceId: 'inv-1', amountMinor: 150000 })).toEqual({ ok: true, confirm: true });
    expect(paystackChargeDecision(pending, { invoiceId: 'other', amountMinor: 150000 }).error).toBe('Invoice mismatch');
    expect(paystackChargeDecision(pending, { invoiceId: 'inv-1', amountMinor: 100 }).error).toBe('Amount mismatch');
  });

  it('treats a second confirmation as a duplicate', () => {
    expect(paystackChargeDecision({ ...pending, status: 'confirmed' }, { invoiceId: 'inv-1', amountMinor: 150000 })).toEqual({
      ok: true,
      duplicate: true,
    });
  });

  it('keeps the Paystack reference out of the M-Pesa receipt field', () => {
    expect(mpesaReceipt({ channel: 'mobile_money', reference: 'REF', authorization: { authorization_code: 'REF' } })).toBeNull();
    expect(mpesaReceipt({ channel: 'mobile_money', reference: 'REF', authorization: { authorization_code: 'QWE123' } })).toBe('QWE123');
    expect(mpesaReceipt({ channel: 'card', reference: 'REF' })).toBeNull();
  });
});
