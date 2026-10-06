import { useQuery } from '@tanstack/react-query';
import { db } from './supabase';

export interface CustomerOption { id: string; label: string }

export function useCustomerOptions(enabled = true) {
  return useQuery({
    queryKey: ['customer-options'],
    enabled,
    queryFn: async (): Promise<CustomerOption[]> => {
      const { data, error } = await db()
        .from('customers')
        .select('id, company_name, profile:profiles!customers_profile_id_fkey(full_name, phone)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
        const name = row.company_name || profile?.full_name || 'Unnamed customer';
        return { id: row.id, label: profile?.phone ? `${name} · ${profile.phone}` : name };
      }).sort((a, b) => a.label.localeCompare(b.label));
    },
  });
}

export function useVesselOptions(customerId: string) {
  return useQuery({
    queryKey: ['vessel-options', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await db().from('vessels').select('id, name, registration_no').eq('customer_id', customerId).order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
}
