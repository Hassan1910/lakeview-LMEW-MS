const LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  acknowledged: 'Acknowledged',
  shipped: 'Shipped',
  received: 'Received',
  cancelled: 'Cancelled',
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  completed: 'Completed',
  no_show: 'No show',
  in: 'Stock in',
  out: 'Stock out',
  adjustment: 'Adjustment',
  return: 'Return',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
  boat_repair: 'Boat repair',
  ship_repair: 'Ship repair',
  engine_maintenance: 'Engine maintenance',
  fabrication: 'Fabrication',
  electrical: 'Electrical',
  welding: 'Welding',
  equipment_supply: 'Equipment supply',
  consultation: 'Consultation',
  other: 'Other',
  store_manager: 'Store manager',
  procurement_officer: 'Procurement officer',
  receptionist: 'Receptionist',
  supplier: 'Supplier',
  administrator: 'Administrator',
};

export function statusLabel(status: string | null | undefined) {
  if (!status) return '—';
  return LABELS[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
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
