<template>
  <PageHeader title="Request on behalf of a customer" description="Log work at the desk or over the phone." />
  <AppCard>
    <form class="grid max-w-3xl gap-3 md:grid-cols-2" @submit.prevent="submit">
      <AppField label="Customer" required>
        <select v-model="form.customer_id" class="field-input" required>
          <option value="">Choose a customer…</option>
          <option v-for="customer in customers" :key="customer.id" :value="customer.id">{{ customer.label }}</option>
        </select>
      </AppField>
      <AppField label="Vessel">
        <select v-model="form.vessel_id" class="field-input" :disabled="!form.customer_id">
          <option value="">No vessel</option>
          <option v-for="vessel in vessels" :key="vessel.id" :value="vessel.id">{{ vessel.name }}</option>
        </select>
      </AppField>
      <div class="md:col-span-2"><AppField label="Title" required><input v-model="form.title" class="field-input" /></AppField></div>
      <div class="md:col-span-2"><AppField label="Description" required><textarea v-model="form.description" class="field-input" rows="4" /></AppField></div>
      <AppField label="Location"><input v-model="form.location_text" class="field-input" /></AppField>
      <AppField label="Category">
        <select v-model="form.category" class="field-input">
          <option v-for="option in categories" :key="option" :value="option">{{ statusLabel(option) }}</option>
        </select>
      </AppField>
      <AppField label="Priority">
        <select v-model="form.priority" class="field-input">
          <option v-for="option in priorities" :key="option" :value="option">{{ statusLabel(option) }}</option>
        </select>
      </AppField>
      <div><AppButton type="submit" :disabled="saving">{{ saving ? 'Creating…' : 'Create request' }}</AppButton></div>
    </form>
    <div class="mt-3 space-y-2">
      <AppNotice tone="error" :message="error" />
      <AppNotice tone="success" :message="success" />
    </div>
  </AppCard>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { db } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';
import { statusLabel } from '../lib/format';
import PageHeader from '../components/PageHeader.vue';
import AppCard from '../components/AppCard.vue';
import AppField from '../components/AppField.vue';
import AppButton from '../components/AppButton.vue';
import AppNotice from '../components/AppNotice.vue';

const categories = ['boat_repair', 'ship_repair', 'engine_maintenance', 'fabrication', 'electrical', 'welding', 'equipment_supply', 'consultation', 'other'];
const priorities = ['low', 'medium', 'high', 'urgent'];
const form = reactive({ customer_id: '', vessel_id: '', title: '', description: '', location_text: '', category: 'engine_maintenance', priority: 'medium' });
const customers = ref<{ id: string; label: string }[]>([]);
const vessels = ref<{ id: string; name: string; customer_id: string }[]>([]);
const error = ref<string | null>(null);
const success = ref<string | null>(null);
const saving = ref(false);
const auth = useAuthStore();

onMounted(async () => {
  const { data } = await db().from('customers').select('id, company_name, profile:profiles(full_name)').order('created_at', { ascending: false });
  customers.value = (data ?? []).map((row) => {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    return { id: row.id, label: row.company_name || profile?.full_name || 'Customer' };
  });
});

watch(() => form.customer_id, async (customerId) => {
  form.vessel_id = '';
  if (!customerId) {
    vessels.value = [];
    return;
  }
  const { data } = await db().from('vessels').select('id, name, customer_id').eq('customer_id', customerId);
  vessels.value = data ?? [];
});

async function submit() {
  if (!form.customer_id) return error.value = 'Choose a customer.';
  if (form.title.trim().length < 3) return error.value = 'Give the request a short title.';
  if (form.description.trim().length < 5) return error.value = 'Describe the work needed.';
  saving.value = true;
  const { error: insertError } = await db().from('service_requests').insert({
    customer_id: form.customer_id,
    vessel_id: form.vessel_id || null,
    title: form.title.trim(),
    description: form.description.trim(),
    location_text: form.location_text,
    category: form.category,
    priority: form.priority,
    created_by: auth.profile?.id ?? null,
  });
  saving.value = false;
  error.value = insertError?.message ?? null;
  success.value = insertError ? null : 'Request created.';
  if (!insertError) {
    form.title = '';
    form.description = '';
    form.location_text = '';
  }
}
</script>
