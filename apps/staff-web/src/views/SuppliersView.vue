<template>
  <section>
    <h1 class="mb-4 text-xl font-semibold">Suppliers</h1>
    <form class="mb-4 grid gap-2 md:grid-cols-2" @submit.prevent="create">
      <InputText v-model="form.name" placeholder="Name" />
      <InputText v-model="form.phone" placeholder="Phone" />
      <InputText v-model="form.email" placeholder="Email" />
      <Button type="submit" :label="editing ? 'Save supplier' : 'Add supplier'" />
      <Button v-if="editing" type="button" label="Cancel" severity="secondary" @click="reset" />
    </form>
    <Message v-if="error" severity="error">{{ error }}</Message>
    <p v-if="query.isLoading.value">Loading…</p>
    <p v-else-if="query.isError.value" class="text-red-600">{{ (query.error.value as Error).message }}</p>
    <p v-else-if="!(query.data.value ?? []).length">No suppliers.</p>
    <DataTable v-else :value="query.data.value" selection-mode="single" @row-click="edit">
      <Column field="name" header="Name" />
      <Column field="phone" header="Phone" />
      <Column field="email" header="Email" />
      <Column field="is_active" header="Active" />
    </DataTable>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { db } from '../lib/supabase';

const form = reactive({ name: '', phone: '', email: '' });
const editing = ref<string | null>(null);
const error = ref<string | null>(null);
const queryClient = useQueryClient();
const query = useQuery({
  queryKey: ['suppliers'],
  queryFn: async () => {
    const { data, error: listError } = await db().from('suppliers').select('id, name, phone, email, is_active').order('name');
    if (listError) throw listError;
    return data ?? [];
  },
});

function edit(event: { data: { id: string; name: string; phone: string | null; email: string | null } }) {
  editing.value = event.data.id;
  form.name = event.data.name;
  form.phone = event.data.phone ?? '';
  form.email = event.data.email ?? '';
}

function reset() {
  editing.value = null;
  form.name = '';
  form.phone = '';
  form.email = '';
}

async function create() {
  const payload = { name: form.name, phone: form.phone, email: form.email };
  const result = editing.value
    ? await db().from('suppliers').update(payload).eq('id', editing.value)
    : await db().from('suppliers').insert(payload);
  error.value = result.error?.message ?? null;
  if (!result.error) {
    reset();
    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
  }
}
</script>
