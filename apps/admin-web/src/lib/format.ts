const SERVICE_LABELS: Record<string, string> = {
  request_received: 'Request received',
  inspection_in_progress: 'Inspection in progress',
  quotation_pending: 'Preparing quotation',
  quotation_sent: 'Quotation sent',
  awaiting_approval: 'Awaiting approval',
  awaiting_spare_parts: 'Awaiting spare parts',
  under_repair: 'Under repair',
  testing: 'Testing',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const EXTRA_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  acknowledged: 'Acknowledged',
  shipped: 'Shipped',
  received: 'Received',
  paid: 'Paid',
  pending: 'Pending',
  confirmed: 'Confirmed',
  refunded: 'Refunded',
  overdue: 'Overdue',
  partial: 'Partially paid',
  issued: 'Issued',
  accepted: 'Accepted',
  rejected: 'Rejected',
  active: 'Active',
  suspended: 'Suspended',
  scheduled: 'Scheduled',
  no_show: 'No show',
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
  mpesa: 'M-Pesa',
  card: 'Card',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
  in: 'Stock in',
  out: 'Stock out',
  adjustment: 'Adjustment',
  return: 'Return',
  boat_repair: 'Boat repair',
  ship_repair: 'Ship repair',
  engine_maintenance: 'Engine maintenance',
  fabrication: 'Fabrication',
  electrical: 'Electrical',
  welding: 'Welding',
  equipment_supply: 'Equipment supply',
  consultation: 'Consultation',
  other: 'Other',
};

export function statusLabel(status: string | null | undefined) {
  if (!status) return '—';
  return SERVICE_LABELS[status] ?? EXTRA_LABELS[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatWhen(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatMoney(amount: number | null | undefined, currency = 'KES') {
  return `${currency} ${Number(amount ?? 0).toLocaleString()}`;
}
