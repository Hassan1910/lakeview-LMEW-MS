import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { invoiceStatusLabel, labelize } from '../lib/format';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type Tone = { color: string; bg: string; icon: IconName; label: string };

const jobTones: Record<string, Tone> = {
  assigned: { label: 'Assigned', color: '#0B4F6C', bg: '#E8F1F5', icon: 'clipboard-outline' },
  in_progress: { label: 'In progress', color: '#6D28D9', bg: '#F5F3FF', icon: 'wrench' },
  blocked: { label: 'Blocked', color: '#B45309', bg: '#FFFBEB', icon: 'alert-outline' },
  completed: { label: 'Completed', color: '#166534', bg: '#ECFDF5', icon: 'check-circle-outline' },
  cancelled: { label: 'Cancelled', color: '#B91C1C', bg: '#FEF2F2', icon: 'close-circle-outline' },
};

const serviceTones: Record<string, Tone> = {
  request_received: { label: 'Request received', color: '#475569', bg: '#F1F5F9', icon: 'inbox-arrow-down' },
  inspection_in_progress: { label: 'Inspection', color: '#0369A1', bg: '#E0F2FE', icon: 'magnify' },
  quotation_pending: { label: 'Preparing quotation', color: '#B45309', bg: '#FFFBEB', icon: 'file-document-edit-outline' },
  quotation_sent: { label: 'Quotation sent', color: '#0B4F6C', bg: '#E8F1F5', icon: 'send-outline' },
  awaiting_approval: { label: 'Awaiting approval', color: '#B45309', bg: '#FFFBEB', icon: 'account-clock-outline' },
  awaiting_spare_parts: { label: 'Awaiting parts', color: '#C2410C', bg: '#FFF7ED', icon: 'package-variant' },
  under_repair: { label: 'Under repair', color: '#6D28D9', bg: '#F5F3FF', icon: 'wrench' },
  testing: { label: 'Testing', color: '#0E7490', bg: '#ECFEFF', icon: 'flask-outline' },
  completed: { label: 'Completed', color: '#166534', bg: '#ECFDF5', icon: 'check-circle-outline' },
  cancelled: { label: 'Cancelled', color: '#B91C1C', bg: '#FEF2F2', icon: 'close-circle-outline' },
};

const invoiceTones: Record<string, Omit<Tone, 'label'> & { label?: string }> = {
  paid: { color: '#166534', bg: '#ECFDF5', icon: 'check-circle-outline' },
  overdue: { color: '#B91C1C', bg: '#FEF2F2', icon: 'clock-alert-outline' },
  issued: { color: '#B45309', bg: '#FFFBEB', icon: 'clock-outline' },
  partially_paid: { color: '#B45309', bg: '#FFFBEB', icon: 'clock-outline' },
  draft: { color: '#475569', bg: '#F1F5F9', icon: 'file-outline' },
  cancelled: { color: '#B91C1C', bg: '#FEF2F2', icon: 'close-circle-outline' },
};

const quoteTones: Record<string, Tone> = {
  draft: { label: 'Draft', color: '#475569', bg: '#F1F5F9', icon: 'file-outline' },
  sent: { label: 'Sent', color: '#0B4F6C', bg: '#E8F1F5', icon: 'send-outline' },
  accepted: { label: 'Accepted', color: '#166534', bg: '#ECFDF5', icon: 'check-circle-outline' },
  rejected: { label: 'Rejected', color: '#B91C1C', bg: '#FEF2F2', icon: 'close-circle-outline' },
  expired: { label: 'Expired', color: '#B45309', bg: '#FFFBEB', icon: 'clock-outline' },
};

const priorityTones: Record<string, Tone> = {
  low: { label: 'Low', color: '#475569', bg: '#F1F5F9', icon: 'arrow-down' },
  medium: { label: 'Medium', color: '#0B4F6C', bg: '#E8F1F5', icon: 'minus' },
  high: { label: 'High', color: '#B45309', bg: '#FFFBEB', icon: 'arrow-up' },
  urgent: { label: 'Urgent', color: '#B91C1C', bg: '#FEF2F2', icon: 'alert' },
};

function Badge({ tone }: { tone: Tone }) {
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]} accessibilityRole="text" accessibilityLabel={tone.label}>
      <MaterialCommunityIcons name={tone.icon} size={14} color={tone.color} />
      <Text style={[styles.label, { color: tone.color }]} numberOfLines={1}>{tone.label}</Text>
    </View>
  );
}

export function StatusBadge({ kind, status }: { kind: 'job' | 'service' | 'invoice' | 'quote'; status: string | null | undefined }) {
  if (!status) return null;
  if (kind === 'invoice') {
    const tone = invoiceTones[status] ?? { color: '#475569', bg: '#F1F5F9', icon: 'file-outline' as IconName };
    return <Badge tone={{ ...tone, label: invoiceStatusLabel(status) }} />;
  }
  const table = kind === 'job' ? jobTones : kind === 'quote' ? quoteTones : serviceTones;
  const tone = table[status] ?? { label: labelize(status), color: '#475569', bg: '#F1F5F9', icon: 'information-outline' as IconName };
  return <Badge tone={tone} />;
}

export function PriorityBadge({ priority }: { priority: string | null | undefined }) {
  if (!priority) return null;
  const tone = priorityTones[priority] ?? { label: labelize(priority), color: '#475569', bg: '#F1F5F9', icon: 'flag-outline' as IconName };
  return <Badge tone={tone} />;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  label: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
});
