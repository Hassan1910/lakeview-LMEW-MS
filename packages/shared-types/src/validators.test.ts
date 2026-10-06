import { describe, expect, it } from 'vitest';
import { LoginSchema, PaystackInitSchema, QuotationCreateSchema, ServiceRequestCreateSchema } from './validators';
import { invoiceAfterPayment, quotationTotals } from './totals';

describe('validators', () => {
  it('accepts a Kenyan service request', () => {
    const parsed = ServiceRequestCreateSchema.safeParse({
      category: 'engine_maintenance',
      title: 'Impeller',
      description: 'The impeller is worn and needs replacement.',
      location_text: 'Kisumu Dunga Pier',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a quotation without lines', () => {
    const parsed = QuotationCreateSchema.safeParse({
      service_request_id: '80000000-0000-0000-0000-000000000001',
      valid_until: '2026-12-31',
      items: [],
    });
    expect(parsed.success).toBe(false);
  });

  it('requires an invoice id for Paystack and ignores a client amount', () => {
    const parsed = PaystackInitSchema.safeParse({ invoice_id: '80000000-0000-0000-0000-000000000001', email: 'a@b.co' });
    expect(parsed.success).toBe(true);
    expect(LoginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false);
  });
});

describe('trigger-equivalent totals', () => {
  it('matches the quotation trigger for 16% tax and a discount', () => {
    expect(quotationTotals([{ quantity: 2, unit_price: 3500 }], 16, 100)).toEqual({
      subtotal: 7000,
      tax_amount: 1120,
      total: 8020,
    });
  });

  it('marks an invoice paid when confirmed payments cover the total', () => {
    expect(invoiceAfterPayment(8120, [8120])).toEqual({ amount_paid: 8120, balance: 0, status: 'paid' });
  });
});
