export const serviceStatusConfig = {
  request_received: { label: 'Request Received', color: '#64748B', bgColor: '#F8FAFC', stepIndex: 0 },
  inspection_in_progress: { label: 'Inspection in Progress', color: '#01BAEF', bgColor: '#E0F7FE', stepIndex: 1 },
  quotation_pending: { label: 'Preparing Quotation', color: '#F59E0B', bgColor: '#FFFBEB', stepIndex: 2 },
  quotation_sent: { label: 'Quotation Sent', color: '#0B4F6C', bgColor: '#E8F1F5', stepIndex: 3 },
  awaiting_approval: { label: 'Awaiting Your Approval', color: '#F59E0B', bgColor: '#FFFBEB', stepIndex: 4 },
  awaiting_spare_parts: { label: 'Awaiting Spare Parts', color: '#F97316', bgColor: '#FFF7ED', stepIndex: 5 },
  under_repair: { label: 'Under Repair', color: '#8B5CF6', bgColor: '#F5F3FF', stepIndex: 6 },
  testing: { label: 'Testing', color: '#06B6D4', bgColor: '#ECFEFF', stepIndex: 7 },
  completed: { label: 'Completed', color: '#22C55E', bgColor: '#ECFDF5', stepIndex: 8 },
  cancelled: { label: 'Cancelled', color: '#EF4444', bgColor: '#FEF2F2', stepIndex: -1 },
} as const;

export type ServiceStatusKey = keyof typeof serviceStatusConfig;

export const SERVICE_STATUS_ORDER = [
  'request_received',
  'inspection_in_progress',
  'quotation_pending',
  'quotation_sent',
  'awaiting_approval',
  'awaiting_spare_parts',
  'under_repair',
  'testing',
  'completed',
] as const;
