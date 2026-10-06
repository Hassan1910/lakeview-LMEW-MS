<template>
  <PageHeader title="Appointments" description="Customer visits, inspections, and drop-offs." />
  <AppCard title="Schedule an appointment">
    <form class="grid gap-3 md:grid-cols-2" @submit.prevent="create">
      <AppField label="Customer" required>
        <select v-model="form.customer_id" class="field-input" required>
          <option value="">Choose a customer…</option>
          <option v-for="customer in customers" :key="customer.id" :value="customer.id">{{ customer.label }}</option>
        </select>
      </AppField>
      <AppField label="When" required><input v-model="form.scheduled_at" class="field-input" type="datetime-local" required /></AppField>
      <AppField label="Purpose"><input v-model="form.purpose" class="field-input" /></AppField>
      <div class="flex items-end"><AppButton type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Schedule' }}</AppButton></div>
    </form>
    <div class="mt-3 space-y-2">
      <AppNotice tone="error" :message="error" />
      <AppNotice tone="success" :message="success" />
    </div>
  </AppCard>
  <SkeletonRows v-if="query.isLoading.value" />
  <AppNotice v-else-if="query.isError.value" tone="error" :message="(query.error.value as Error).message" />
  <EmptyState v-else-if="!(query.data.value ?? []).length" title="No appointments yet." />
  <SimpleTable v-else :head="['When', 'Purpose', 'Status']">
    <tr v-for="row in query.data.value" :key="row.id">
      <td class="td">{{ formatWhen(row.scheduled_at) }}</td>
      <td class="td">{{ row.purpose || '—' }}</td>
      <td class="td"><AppBadge :status="row.status" /></td>
    </tr>
  </SimpleTable>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { db } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';
import { formatWhen } from '../lib/format';
import PageHeader from '../components/PageHeader.vue';
import AppCard from '../components/AppCard.vue';
import AppField from '../components/AppField.vue';
import AppButton from '../components/AppButton.vue';
import AppNotice from '../components/AppNotice.vue';
import AppBadge from '../components/AppBadge.vue';
import SkeletonRows from '../components/SkeletonRows.vue';
import EmptyState from '../components/EmptyState.vue';
import SimpleTable from '../components/SimpleTable.vue';

const form = reactive({ customer_id: '', scheduled_at: '', purpose: '' });
const error = ref<string | null>(null);
const success = ref<string | null>(null);
const saving = ref(false);
const customers = ref<{ id: string; label: string }[]>([]);
const auth = useAuthStore();
const queryClient = useQueryClient();
const query = useQuery({
  queryKey: ['appointments'],
  queryFn: async () => {
    const { data, error: listError } = await db().from('appointments').select('id, scheduled_at, purpose, status').order('scheduled_at');
    if (listError) throw listError;
    return data ?? [];
  },
});

onMounted(async () => {
  const { data } = await db().from('customers').select('id, company_name, profile:profiles(full_name)').order('created_at', { ascending: false });
  customers.value = (data ?? []).map((row) => {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    return { id: row.id, label: row.company_name || profile?.full_name || 'Customer' };
  });
});

async function create() {
  if (!form.customer_id) return error.value = 'Choose a customer.';
  if (!form.scheduled_at) return error.value = 'Choose a date and time.';
  saving.value = true;
  const { error: insertError } = await db().from('appointments').insert({
    customer_id: form.customer_id,
    scheduled_at: new Date(form.scheduled_at).toISOString(),
    purpose: form.purpose,
    created_by: auth.profile?.id,
  });
  saving.value = false;
  error.value = insertError?.message ?? null;
  success.value = insertError ? null : 'Appointment scheduled.';
  if (!insertError) {
    form.customer_id = '';
    form.scheduled_at = '';
    form.purpose = '';
    queryClient.invalidateQueries({ queryKey: ['appointments'] });
  }
}
</script>
