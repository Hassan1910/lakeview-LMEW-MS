import {
  MOBILE_PAYSTACK_CALLBACK as EDGE_CALLBACK,
  mpesaReceipt,
  paystackChargeDecision,
  planPendingPaystackResume,
  resolvePaystackCallback,
  paystackRefundDecision,
  paystackRefundReference,
  paymentFailurePatch,
  settlePaystackCharge,
  storedAuthorizationUrl,
} from '../../../supabase/functions/_shared/paystack';
import { MOBILE_PAYSTACK_CALLBACK, classifyPaystackNavigation } from './paystack-flow';
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

  it('does not confirm a refunded payment or a non-KES charge', () => {
    expect(paystackChargeDecision({ ...pending, status: 'refunded' }, { invoiceId: 'inv-1', amountMinor: 150000 })).toMatchObject({
      ok: false,
      error: 'Payment was refunded',
    });
    expect(paystackChargeDecision(pending, { invoiceId: 'inv-1', amountMinor: 150000, currency: 'USD' }).error).toBe('Currency mismatch');
  });

  it('keeps an open checkout when Paystack is briefly unavailable', () => {
    expect(planPendingPaystackResume({
      pendingAmount: 1500,
      invoiceBalance: 1500,
      hasCheckoutUrl: true,
      lookup: { kind: 'unreachable' },
    })).toEqual({ action: 'resume' });
    expect(planPendingPaystackResume({
      pendingAmount: 1500,
      invoiceBalance: 1500,
      hasCheckoutUrl: true,
      lookup: { kind: 'missing' },
    })).toEqual({ action: 'resume' });
    expect(planPendingPaystackResume({
      pendingAmount: 1500,
      invoiceBalance: 500,
      hasCheckoutUrl: true,
      lookup: { kind: 'found', status: 'ongoing' },
    }).action).toBe('stop');
    expect(planPendingPaystackResume({
      pendingAmount: 1500,
      invoiceBalance: 500,
      hasCheckoutUrl: false,
      lookup: { kind: 'missing' },
    })).toEqual({ action: 'release' });
    expect(planPendingPaystackResume({
      pendingAmount: 1500,
      invoiceBalance: 1500,
      hasCheckoutUrl: true,
      lookup: { kind: 'found', status: 'success' },
    })).toEqual({ action: 'settle' });
  });

  it('keeps the mobile callback in sync with the app', () => {
    expect(EDGE_CALLBACK).toBe(MOBILE_PAYSTACK_CALLBACK);
  });

  it('allows only the app callback or the configured callback', () => {
    expect(resolvePaystackCallback(undefined, 'https://pay.example/callback')).toEqual({
      ok: true,
      callback: 'https://pay.example/callback',
    });
    expect(resolvePaystackCallback(MOBILE_PAYSTACK_CALLBACK, undefined)).toEqual({ ok: true, callback: MOBILE_PAYSTACK_CALLBACK });
    expect(resolvePaystackCallback('https://pay.example/callback', 'https://pay.example/callback').ok).toBe(true);
    expect(resolvePaystackCallback('https://evil.example/callback', 'https://pay.example/callback').ok).toBe(false);
    expect(resolvePaystackCallback(`${MOBILE_PAYSTACK_CALLBACK}?next=https://evil.example`, undefined).ok).toBe(false);
  });

  it('confirms a verified charge only when Paystack reports success', () => {
    expect(settlePaystackCharge(pending, { status: 'success', amount: 150000, metadata: { invoice_id: 'inv-1' } })).toEqual({
      outcome: 'confirmed',
      duplicate: false,
    });
    expect(settlePaystackCharge(pending, { status: 'ongoing', amount: 150000 })).toEqual({ outcome: 'processing' });
    expect(settlePaystackCharge(pending, { status: 'abandoned', amount: 150000 })).toEqual({ outcome: 'cancelled', change: true });
    expect(settlePaystackCharge(pending, { status: 'failed', amount: 150000 })).toEqual({ outcome: 'failed', change: true });
    expect(paymentFailurePatch({ status: 'abandoned' }, 'cancelled').status).toBe('cancelled');
    expect(paymentFailurePatch({ status: 'failed' }, 'failed').status).toBe('failed');
    expect(settlePaystackCharge({ ...pending, status: 'confirmed' }, { status: 'abandoned', amount: 150000 })).toEqual({
      outcome: 'confirmed',
      duplicate: true,
    });
    expect(settlePaystackCharge(pending, { status: 'success', amount: 100, metadata: { invoice_id: 'inv-1' } }).outcome).toBe('error');
  });

  it('resumes only an https checkout url stored at initialization', () => {
    expect(storedAuthorizationUrl({ initialize: { authorization_url: 'https://checkout.paystack.com/abc' } })).toBe(
      'https://checkout.paystack.com/abc',
    );
    expect(storedAuthorizationUrl({ initialize: { authorization_url: 'http://evil.example' } })).toBeNull();
  });

  it('classifies checkout redirects by prefix', () => {
    expect(classifyPaystackNavigation('https://checkout.paystack.com/abc')).toBe('checkout');
    expect(classifyPaystackNavigation(`${MOBILE_PAYSTACK_CALLBACK}?reference=LMEW-1`)).toBe('callback');
    expect(classifyPaystackNavigation('lmew://paystack/cancel?reference=LMEW-1')).toBe('cancel');
    expect(classifyPaystackNavigation('https://standard.paystack.co/close')).toBe('close');
    expect(classifyPaystackNavigation('https://joinzap.com/app/pay')).toBe('partner');
    expect(classifyPaystackNavigation('https://evil.example/?u=https://joinzap.com/app/')).toBe('checkout');
    expect(classifyPaystackNavigation('https://checkout.paystack.com/3ds')).toBe('checkout');
  });

  it('marks a processed Paystack refund against the original charge', () => {
    expect(paystackRefundReference({ transaction_reference: 'LMEW-1' })).toBe('LMEW-1');
    expect(paystackRefundReference({ transaction: { reference: 'LMEW-2' } })).toBe('LMEW-2');
    expect(paystackRefundDecision({ status: 'confirmed', amount: 1500 }, { amountMinor: 150000, currency: 'KES' })).toEqual({ action: 'refund' });
    expect(paystackRefundDecision({ status: 'refunded', amount: 1500 }, { amountMinor: 150000 })).toEqual({ action: 'duplicate' });
    expect(paystackRefundDecision({ status: 'pending', amount: 1500 }, { amountMinor: 150000 }).action).toBe('error');
    expect(paystackRefundDecision({ status: 'confirmed', amount: 1500 }, { amountMinor: 50000 }).action).toBe('error');
  });

  it('keeps the Paystack reference out of the M-Pesa receipt field', () => {
    expect(mpesaReceipt({ channel: 'mobile_money', reference: 'REF', authorization: { authorization_code: 'REF' } })).toBeNull();
    expect(mpesaReceipt({ channel: 'mobile_money', reference: 'REF', authorization: { authorization_code: 'QWE123' } })).toBe('QWE123');
    expect(mpesaReceipt({ channel: 'card', reference: 'REF' })).toBeNull();
  });
});
