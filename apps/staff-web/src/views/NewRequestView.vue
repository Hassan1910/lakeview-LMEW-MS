<template>
  <section>
    <h1 class="mb-4 text-xl font-semibold">Request on behalf of a customer</h1>
    <form class="grid max-w-xl gap-2" @submit.prevent="submit">
      <Select v-model="form.customer_id" :options="customers" option-label="label" option-value="id" placeholder="Customer" />
      <Select v-model="form.vessel_id" :options="vessels" option-label="name" option-value="id" placeholder="Vessel" />
      <InputText v-model="form.title" placeholder="Title" />
      <Textarea v-model="form.description" placeholder="Description" rows="4" />
      <InputText v-model="form.location_text" placeholder="Location" />
      <Select v-model="form.category" :options="categories" />
      <Select v-model="form.priority" :options="priorities" />
      <Button type="submit" label="Create request" />
    </form>
    <Message v-if="error" severity="error">{{ error }}</Message>
    <Message v-if="success" severity="success">{{ success }}</Message>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { db } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';

const categories = ['boat_repair', 'ship_repair', 'engine_maintenance', 'fabrication', 'electrical', 'welding', 'equipment_supply', 'consultation', 'other'];
const priorities = ['low', 'medium', 'high', 'urgent'];
const form = reactive({ customer_id: '', vessel_id: '', title: '', description: '', location_text: '', category: 'engine_maintenance', priority: 'medium' });
const customers = ref<{ id: string; label: string }[]>([]);
const vessels = ref<{ id: string; name: string; customer_id: string }[]>([]);
const error = ref<string | null>(null);
const success = ref<string | null>(null);
const auth = useAuthStore();

onMounted(async () => {
  const { data } = await db().from('customers').select('id, company_name, profile:profiles(full_name)').order('created_at', { ascending: false });
  customers.value = (data ?? []).map((row) => {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    return { id: row.id, label: row.company_name || profile?.full_name || row.id };
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
  if (!form.customer_id) {
    error.value = 'Choose a customer';
    return;
  }
  const { error: insertError } = await db().from('service_requests').insert({
    customer_id: form.customer_id,
    vessel_id: form.vessel_id || null,
    title: form.title,
    description: form.description,
    location_text: form.location_text,
    category: form.category,
    priority: form.priority,
    created_by: auth.profile?.id ?? null,
  });
  error.value = insertError?.message ?? null;
  success.value = insertError ? null : 'Request created';
}
</script>
