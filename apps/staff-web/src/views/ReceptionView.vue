<template>
  <PageHeader title="Walk-in customer" description="Record a customer who does not have an account yet." />
  <AppCard title="New walk-in">
    <form class="grid max-w-xl gap-3" @submit.prevent="submit">
      <AppField label="Company or customer name" required><input v-model="form.company_name" class="field-input" required /></AppField>
      <AppField label="KRA PIN"><input v-model="form.kra_pin" class="field-input" /></AppField>
      <AppField label="Notes"><textarea v-model="form.notes" class="field-input" rows="3" /></AppField>
      <AppButton type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Save walk-in' }}</AppButton>
    </form>
    <div class="mt-3 space-y-2">
      <AppNotice tone="error" :message="error" />
      <AppNotice tone="success" :message="success" />
    </div>
  </AppCard>
  <SkeletonRows v-if="query.isLoading.value" />
  <EmptyState v-else-if="!(query.data.value ?? []).length" title="No walk-in records yet." />
  <SimpleTable v-else :head="['Customer', 'KRA PIN']">
    <tr v-for="row in query.data.value" :key="row.id">
      <td class="td font-medium">{{ row.company_name || 'Unnamed customer' }}</td>
      <td class="td">{{ row.kra_pin || '—' }}</td>
    </tr>
  </SimpleTable>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { db } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';
import PageHeader from '../components/PageHeader.vue';
import AppCard from '../components/AppCard.vue';
import AppField from '../components/AppField.vue';
import AppButton from '../components/AppButton.vue';
import AppNotice from '../components/AppNotice.vue';
import SkeletonRows from '../components/SkeletonRows.vue';
import EmptyState from '../components/EmptyState.vue';
import SimpleTable from '../components/SimpleTable.vue';

const form = reactive({ company_name: '', kra_pin: '', notes: '' });
const error = ref<string | null>(null);
const success = ref<string | null>(null);
const saving = ref(false);
const auth = useAuthStore();
const queryClient = useQueryClient();
const query = useQuery({
  queryKey: ['walkins'],
  queryFn: async () => {
    const { data, error: listError } = await db().from('customers').select('id, company_name, kra_pin').is('profile_id', null).order('created_at', { ascending: false });
    if (listError) throw listError;
    return data ?? [];
  },
});

async function submit() {
  if (form.company_name.trim().length < 2) return error.value = 'Enter the customer name.';
  saving.value = true;
  const { error: insertError } = await db().from('customers').insert({
    company_name: form.company_name.trim(),
    kra_pin: form.kra_pin,
    notes: form.notes,
    created_by: auth.profile?.id,
  });
  saving.value = false;
  error.value = insertError?.message ?? null;
  success.value = insertError ? null : 'Walk-in saved.';
  if (!insertError) {
    form.company_name = '';
    form.kra_pin = '';
    form.notes = '';
    queryClient.invalidateQueries({ queryKey: ['walkins'] });
  }
}
</script>
