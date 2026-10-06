<template>
  <section>
    <h1 class="mb-4 text-xl font-semibold">My orders</h1>
    <p v-if="query.isLoading.value">Loading…</p>
    <p v-else-if="query.isError.value" class="text-red-600">{{ (query.error.value as Error).message }}</p>
    <p v-else-if="!(query.data.value ?? []).length">No orders assigned to your supplier profile.</p>
    <ul v-else class="space-y-2">
      <li v-for="order in query.data.value" :key="order.id" class="rounded bg-white p-3">
        <router-link :to="`/purchase-orders/${order.id}`">{{ order.code }}</router-link>
        · {{ order.status }} · {{ order.total }}
        <Button class="ml-2" label="Acknowledge" @click="setStatus(order.id, 'acknowledged')" />
        <Button class="ml-2" label="Shipped" @click="setStatus(order.id, 'shipped')" />
      </li>
    </ul>
    <Message v-if="error" severity="error">{{ error }}</Message>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { db } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const error = ref<string | null>(null);
const queryClient = useQueryClient();
const query = useQuery({
  queryKey: ['my-orders', auth.profile?.id],
  queryFn: async () => {
    const supplier = await db().from('suppliers').select('id').eq('profile_id', auth.profile?.id).maybeSingle();
    if (supplier.error) throw supplier.error;
    if (!supplier.data) return [];
    const { data, error: listError } = await db().from('purchase_orders').select('id, code, status, total').eq('supplier_id', supplier.data.id);
    if (listError) throw listError;
    return data ?? [];
  },
});

async function setStatus(id: string, status: string) {
  const { error: updateError } = await db().from('purchase_orders').update({ status }).eq('id', id);
  error.value = updateError?.message ?? null;
  queryClient.invalidateQueries({ queryKey: ['my-orders'] });
}
</script>
