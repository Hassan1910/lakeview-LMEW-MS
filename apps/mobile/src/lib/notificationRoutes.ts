import { router } from 'expo-router';

export function routeForNotification(data: Record<string, unknown> | null | undefined, role: string | null) {
  if (!data) return null;
  const requestId = data.service_request_id as string | undefined;
  const invoiceId = data.invoice_id as string | undefined;
  const workOrderId = data.work_order_id as string | undefined;
  if (role === 'technician' && workOrderId) return `/(technician)/job/${workOrderId}`;
  if (role === 'supervisor' && workOrderId) return `/(supervisor)/team-jobs/${workOrderId}`;
  if (role === 'customer' && requestId) return `/(customer)/request/${requestId}`;
  if (role === 'customer' && invoiceId) return `/(customer)/invoice/${invoiceId}`;
  return null;
}

export function openNotification(data: Record<string, unknown> | null | undefined, role: string | null) {
  const href = routeForNotification(data, role);
  if (href) router.push(href as never);
}
