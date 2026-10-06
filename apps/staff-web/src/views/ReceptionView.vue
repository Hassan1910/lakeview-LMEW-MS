<template>
  <section>
    <h1 class="mb-4 text-xl font-semibold">Walk-in customer</h1>
    <form class="grid max-w-xl gap-2" @submit.prevent="submit">
      <InputText v-model="form.company_name" placeholder="Company or customer name" />
      <InputText v-model="form.kra_pin" placeholder="KRA PIN" />
      <Textarea v-model="form.notes" placeholder="Notes" rows="3" />
      <Button type="submit" label="Save walk-in" />
    </form>
    <Message v-if="error" severity="error">{{ error }}</Message>
    <Message v-if="success" severity="success">{{ success }}</Message>
    <p v-if="query.isLoading.value" class="mt-4">Loading…</p>
    <p v-else-if="!(query.data.value ?? []).length" class="mt-4">No walk-in records yet.</p>
    <ul v-else class="mt-4">
      <li v-for="row in query.data.value" :key="row.id">{{ row.company_name }} · {{ row.kra_pin }}</li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { db } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';

const form = reactive({ company_name: '', kra_pin: '', notes: '' });
const error = ref<string | null>(null);
const success = ref<string | null>(null);
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
  const { error: insertError } = await db().from('customers').insert({
    company_name: form.company_name,
    kra_pin: form.kra_pin,
    notes: form.notes,
    created_by: auth.profile?.id,
  });
  error.value = insertError?.message ?? null;
  success.value = insertError ? null : 'Walk-in saved';
  if (!insertError) queryClient.invalidateQueries({ queryKey: ['walkins'] });
}
</script>
