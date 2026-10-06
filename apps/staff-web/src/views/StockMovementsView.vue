<template>
  <section>
    <h1 class="mb-4 text-xl font-semibold">Stock movements</h1>
    <form class="mb-4 flex flex-wrap gap-2" @submit.prevent="record">
      <InputText v-model="itemId" placeholder="Inventory item id" />
      <Select v-model="type" :options="types" placeholder="Type" />
      <InputText v-model="quantity" placeholder="Quantity" />
      <InputText v-model="reason" placeholder="Reason" />
      <Button type="submit" label="Record" />
    </form>
    <Message v-if="error" severity="error">{{ error }}</Message>
    <Message v-if="success" severity="success">{{ success }}</Message>
    <p v-if="query.isLoading.value">Loading…</p>
    <p v-else-if="query.isError.value" class="text-red-600">{{ (query.error.value as Error).message }}</p>
    <p v-else-if="!(query.data.value ?? []).length">No movements.</p>
    <DataTable v-else :value="query.data.value">
      <Column field="created_at" header="When" />
      <Column field="type" header="Type" />
      <Column field="quantity" header="Qty" />
      <Column field="reason" header="Reason" />
    </DataTable>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { db } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';

const types = ['in', 'out', 'adjustment', 'return'];
const itemId = ref('');
const type = ref('in');
const quantity = ref('1');
const reason = ref('');
const error = ref<string | null>(null);
const success = ref<string | null>(null);
const auth = useAuthStore();
const queryClient = useQueryClient();

const query = useQuery({
  queryKey: ['movements'],
  queryFn: async () => {
    const { data, error: listError } = await db().from('stock_movements').select('id, created_at, type, quantity, reason').order('created_at', { ascending: false });
    if (listError) throw listError;
    return data ?? [];
  },
});

async function record() {
  const { error: insertError } = await db().from('stock_movements').insert({
    inventory_item_id: itemId.value,
    type: type.value,
    quantity: Number(quantity.value),
    reason: reason.value,
    created_by: auth.profile?.id,
  });
  error.value = insertError?.message ?? null;
  success.value = insertError ? null : 'Movement recorded';
  if (!insertError) queryClient.invalidateQueries({ queryKey: ['movements'] });
}
</script>
