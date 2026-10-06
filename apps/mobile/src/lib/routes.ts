/** Pure navigation targets. Kept free of React Native so the paths can be tested. */

export function routeForNotification(data: Record<string, unknown> | null | undefined, role: string | null) {
  if (!data) return null;
  const requestId = typeof data.service_request_id === 'string' ? data.service_request_id : undefined;
  const invoiceId = typeof data.invoice_id === 'string' ? data.invoice_id : undefined;
  const workOrderId = typeof data.work_order_id === 'string' ? data.work_order_id : undefined;
  if (role === 'technician' && workOrderId) return `/(technician)/job/${workOrderId}`;
  if (role === 'supervisor' && workOrderId) return `/(supervisor)/team-jobs/${workOrderId}`;
  if (role === 'customer' && requestId) return `/(customer)/request/${requestId}`;
  if (role === 'customer' && invoiceId) return `/(customer)/invoice/${invoiceId}`;
  return null;
}

export function routeForSearchHit(kind: string, id: string) {
  if (kind === 'service_request') return `/(customer)/request/${id}`;
  if (kind === 'vessel') return `/(customer)/vessel/${id}`;
  return null;
}
