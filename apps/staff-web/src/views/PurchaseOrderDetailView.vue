<template>
  <section>
    <p v-if="query.isLoading.value">Loading…</p>
    <p v-else-if="query.isError.value" class="text-red-600">{{ (query.error.value as Error).message }}</p>
    <div v-else-if="query.data.value">
      <h1 class="text-xl font-semibold">{{ query.data.value.code }}</h1>
      <p>Status {{ query.data.value.status }} · total {{ query.data.value.total }}</p>
      <form class="my-4 flex flex-wrap gap-2" @submit.prevent="addLine">
        <Select v-model="inventoryItemId" :options="catalog" option-label="name" option-value="id" placeholder="Inventory item" />
        <InputText v-model="description" placeholder="Description" />
        <InputText v-model="quantity" placeholder="Qty" />
        <InputText v-model="unitCost" placeholder="Unit cost" />
        <Button type="submit" label="Add line" />
      </form>
      <Select v-model="status" :options="statuses" />
      <Button class="ml-2" label="Update status" @click="saveStatus" />
      <Button class="ml-2" label="Approve" @click="approve" />
      <Button class="ml-2" label="Receive into stock" @click="receive" />
      <Message v-if="error" severity="error">{{ error }}</Message>
      <ul class="mt-4">
        <li v-for="item in items" :key="item.id">{{ item.description }} · {{ item.quantity }} × {{ item.unit_cost }} = {{ item.line_total }}</li>
      </ul>
      <p v-if="!items.length">No lines yet.</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { db } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';

const statuses = ['draft', 'sent', 'acknowledged', 'shipped', 'received', 'cancelled'];
const route = useRoute();
const description = ref('');
const inventoryItemId = ref<string | null>(null);
const catalog = ref<{ id: string; name: string }[]>([]);
const quantity = ref('1');
const unitCost = ref('0');
const status = ref('draft');
const error = ref<string | null>(null);
const items = ref<{ id: string; description: string; quantity: number; unit_cost: number; line_total: number; inventory_item_id: string | null }[]>([]);
const queryClient = useQueryClient();
const auth = useAuthStore();

const query = useQuery({
  queryKey: ['po', route.params.id],
  queryFn: async () => {
    const { data, error: rowError } = await db().from('purchase_orders').select('*').eq('id', route.params.id).single();
    if (rowError) throw rowError;
    const lines = await db().from('purchase_order_items').select('id, description, quantity, unit_cost, line_total, inventory_item_id').eq('purchase_order_id', route.params.id);
    items.value = lines.data ?? [];
    return data;
  },
});
watch(query.data, (row) => { if (row) status.value = row.status; });

onMounted(async () => {
  const { data } = await db().from('inventory_items').select('id, name').eq('is_active', true).order('name');
  catalog.value = data ?? [];
});

async function addLine() {
  const part = catalog.value.find((item) => item.id === inventoryItemId.value);
  const { error: insertError } = await db().from('purchase_order_items').insert({
    purchase_order_id: route.params.id,
    inventory_item_id: inventoryItemId.value,
    description: description.value || part?.name || 'Item',
    quantity: Number(quantity.value),
    unit_cost: Number(unitCost.value),
  });
  error.value = insertError?.message ?? null;
  if (!insertError) queryClient.invalidateQueries({ queryKey: ['po', route.params.id] });
}

async function saveStatus() {
  const { error: updateError } = await db().from('purchase_orders').update({ status: status.value }).eq('id', route.params.id);
  error.value = updateError?.message ?? null;
  if (!updateError) queryClient.invalidateQueries({ queryKey: ['po', route.params.id] });
}

async function approve() {
  const { error: updateError } = await db().from('purchase_orders').update({ status: 'sent', approved_by: auth.profile?.id ?? null }).eq('id', route.params.id);
  error.value = updateError?.message ?? null;
  if (!updateError) {
    status.value = 'sent';
    queryClient.invalidateQueries({ queryKey: ['po', route.params.id] });
  }
}

async function receive() {
  const lines = items.value.filter((item) => item.inventory_item_id);
  if (!lines.length) {
    error.value = 'Add lines linked to inventory items before receiving stock.';
    return;
  }
  for (const line of lines) {
    const { error: movementError } = await db().from('stock_movements').insert({
      inventory_item_id: line.inventory_item_id,
      type: 'in',
      quantity: line.quantity,
      reason: 'Purchase order received',
      related_po_id: route.params.id,
      created_by: auth.profile?.id ?? null,
    });
    if (movementError) {
      error.value = movementError.message;
      return;
    }
  }
  const { error: updateError } = await db().from('purchase_orders').update({ status: 'received' }).eq('id', route.params.id);
  error.value = updateError?.message ?? null;
  if (!updateError) {
    status.value = 'received';
    queryClient.invalidateQueries({ queryKey: ['po', route.params.id] });
  }
}
</script>
