<template>
  <section>
    <h1 class="mb-4 text-xl font-semibold">Appointments</h1>
    <form class="mb-4 grid gap-2 md:grid-cols-2" @submit.prevent="create">
      <InputText v-model="form.customer_id" placeholder="Customer id" />
      <InputText v-model="form.scheduled_at" type="datetime-local" />
      <InputText v-model="form.purpose" placeholder="Purpose" />
      <Button type="submit" label="Schedule" />
    </form>
    <Message v-if="error" severity="error">{{ error }}</Message>
    <Message v-if="success" severity="success">{{ success }}</Message>
    <p v-if="query.isLoading.value">Loading…</p>
    <p v-else-if="query.isError.value" class="text-red-600">{{ (query.error.value as Error).message }}</p>
    <p v-else-if="!(query.data.value ?? []).length">No appointments.</p>
    <ul v-else>
      <li v-for="row in query.data.value" :key="row.id">{{ row.scheduled_at }} · {{ row.purpose }} · {{ row.status }}</li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { db } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';

const form = reactive({ customer_id: '', scheduled_at: '', purpose: '' });
const error = ref<string | null>(null);
const success = ref<string | null>(null);
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

async function create() {
  const { error: insertError } = await db().from('appointments').insert({
    customer_id: form.customer_id,
    scheduled_at: new Date(form.scheduled_at).toISOString(),
    purpose: form.purpose,
    created_by: auth.profile?.id,
  });
  error.value = insertError?.message ?? null;
  success.value = insertError ? null : 'Appointment scheduled';
  if (!insertError) queryClient.invalidateQueries({ queryKey: ['appointments'] });
}
</script>
