<template>
  <section>
    <h1 class="mb-4 text-xl font-semibold">Purchase orders</h1>
    <form class="mb-4 flex flex-wrap gap-2" @submit.prevent="create">
      <InputText v-model="supplierId" placeholder="Supplier id" />
      <InputText v-model="notes" placeholder="Notes" />
      <Button type="submit" label="Create draft" />
    </form>
    <Message v-if="error" severity="error">{{ error }}</Message>
    <p v-if="query.isLoading.value">Loading…</p>
    <p v-else-if="query.isError.value" class="text-red-600">{{ (query.error.value as Error).message }}</p>
    <p v-else-if="!(query.data.value ?? []).length">No purchase orders.</p>
    <DataTable v-else :value="query.data.value" @row-click="open">
      <Column field="code" header="Code" />
      <Column field="status" header="Status" />
      <Column field="total" header="Total" />
    </DataTable>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { db } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';

const supplierId = ref('');
const notes = ref('');
const error = ref<string | null>(null);
const auth = useAuthStore();
const router = useRouter();
const queryClient = useQueryClient();
const query = useQuery({
  queryKey: ['purchase-orders'],
  queryFn: async () => {
    const { data, error: listError } = await db().from('purchase_orders').select('id, code, status, total').order('created_at', { ascending: false });
    if (listError) throw listError;
    return data ?? [];
  },
});

async function create() {
  const { error: insertError } = await db().from('purchase_orders').insert({ supplier_id: supplierId.value, notes: notes.value, created_by: auth.profile?.id, status: 'draft' });
  error.value = insertError?.message ?? null;
  if (!insertError) queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
}

function open(event: { data: { id: string } }) {
  router.push(`/purchase-orders/${event.data.id}`);
}
</script>
