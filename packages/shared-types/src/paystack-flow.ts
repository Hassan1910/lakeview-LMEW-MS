export const MOBILE_PAYSTACK_CALLBACK = 'lmew://paystack/callback';
export const MOBILE_PAYSTACK_CANCEL = 'lmew://paystack/cancel';
export const PAYSTACK_CLOSE_URL = 'https://standard.paystack.co/close';
export const PAYSTACK_PARTNER_PREFIXES = ['https://joinzap.com/app/'] as const;

export type PaystackNavigation = 'callback' | 'cancel' | 'close' | 'partner' | 'checkout';

function matchesExactUrl(url: string, expected: string) {
  return url === expected || url.startsWith(`${expected}?`) || url.startsWith(`${expected}#`);
}

export function classifyPaystackNavigation(url: string): PaystackNavigation {
  if (matchesExactUrl(url, MOBILE_PAYSTACK_CALLBACK)) return 'callback';
  if (url === MOBILE_PAYSTACK_CANCEL || url.startsWith(`${MOBILE_PAYSTACK_CANCEL}?`) || url.startsWith(`${MOBILE_PAYSTACK_CANCEL}#`)) {
    return 'cancel';
  }
  if (matchesExactUrl(url, PAYSTACK_CLOSE_URL)) return 'close';
  if (PAYSTACK_PARTNER_PREFIXES.some((prefix) => url.startsWith(prefix))) return 'partner';
  return 'checkout';
}
