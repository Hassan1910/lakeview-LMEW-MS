<template>
  <SkeletonRows v-if="query.isLoading.value" />
  <AppNotice v-else-if="query.isError.value" tone="error" :message="(query.error.value as Error).message" />
  <template v-else-if="query.data.value">
    <PageHeader :title="query.data.value.code ?? 'Draft purchase order'" :description="`Status ${statusLabel(query.data.value.status)} · ${formatMoney(query.data.value.total)}`">
      <template #actions>
        <router-link class="text-sm font-medium text-lmew-blue-800 hover:underline" :to="backTo">Back</router-link>
      </template>
    </PageHeader>
    <div class="flex flex-wrap items-center gap-2">
      <AppBadge :status="query.data.value.status" />
    </div>
    <AppCard v-if="!isSupplier && query.data.value.status === 'draft'" title="Add line">
      <form class="grid gap-3 md:grid-cols-5" @submit.prevent="addLine">
        <AppField label="Part">
          <select v-model="inventoryItemId" class="field-input">
            <option value="">Non-stock line…</option>
            <option v-for="item in catalog" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </AppField>
        <AppField label="Description"><input v-model="description" class="field-input" /></AppField>
        <AppField label="Qty"><input v-model="quantity" class="field-input" inputmode="decimal" /></AppField>
        <AppField label="Unit cost"><input v-model="unitCost" class="field-input" inputmode="decimal" /></AppField>
        <div class="flex items-end"><AppButton type="submit" :disabled="busy">Add line</AppButton></div>
      </form>
    </AppCard>
    <AppCard title="Order actions">
      <div v-if="isSupplier" class="flex flex-wrap items-end gap-2">
        <AppButton v-if="query.data.value.status === 'sent'" :disabled="busy" @click="setSupplierStatus('acknowledged')">Acknowledge</AppButton>
        <AppButton v-if="query.data.value.status === 'sent' || query.data.value.status === 'acknowledged'" variant="secondary" :disabled="busy" @click="setSupplierStatus('shipped')">Mark shipped</AppButton>
      </div>
      <div v-else class="flex flex-wrap items-end gap-2">
        <AppField label="Status">
          <select v-model="status" class="field-input">
            <option v-for="option in statuses" :key="option" :value="option">{{ statusLabel(option) }}</option>
          </select>
        </AppField>
        <AppButton variant="secondary" :disabled="busy" @click="saveStatus">Update status</AppButton>
        <AppButton :disabled="busy" @click="approve">Approve and send</AppButton>
        <AppButton :disabled="busy" @click="receive">Receive into stock</AppButton>
      </div>
      <div class="mt-3"><AppNotice :tone="noticeTone" :message="error" /></div>
    </AppCard>
    <AppCard title="Lines">
      <EmptyState v-if="!items.length" title="No lines yet." />
      <SimpleTable v-else :head="['Description', 'Qty', 'Unit cost', 'Line total']">
        <tr v-for="item in items" :key="item.id">
          <td class="td">{{ item.description }}</td>
          <td class="td">{{ item.quantity }}</td>
          <td class="td">{{ formatMoney(item.unit_cost) }}</td>
          <td class="td">{{ formatMoney(item.line_total) }}</td>
        </tr>
      </SimpleTable>
    </AppCard>
  </template>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { db } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';
import { confirm } from '../lib/confirm';
import { formatMoney, statusLabel } from '../lib/format';
import PageHeader from '../components/PageHeader.vue';
import AppCard from '../components/AppCard.vue';
import AppField from '../components/AppField.vue';
import AppButton from '../components/AppButton.vue';
import AppNotice from '../components/AppNotice.vue';
import AppBadge from '../components/AppBadge.vue';
import SkeletonRows from '../components/SkeletonRows.vue';
import EmptyState from '../components/EmptyState.vue';
import SimpleTable from '../components/SimpleTable.vue';

const statuses = ['draft', 'sent', 'acknowledged', 'shipped', 'cancelled'];
const route = useRoute();
const description = ref('');
const inventoryItemId = ref('');
const catalog = ref<{ id: string; name: string }[]>([]);
const quantity = ref('1');
const unitCost = ref('0');
const status = ref('draft');
const error = ref<string | null>(null);
const noticeTone = ref<'error' | 'success'>('error');
const busy = ref(false);
const items = ref<{ id: string; description: string; quantity: number; unit_cost: number; line_total: number; inventory_item_id: string | null }[]>([]);
const queryClient = useQueryClient();
const auth = useAuthStore();
const isSupplier = computed(() => auth.profile?.role === 'supplier');
const backTo = computed(() => (isSupplier.value ? '/my-orders' : '/purchase-orders'));

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

function note(message: string | null, ok: boolean) {
  error.value = message;
  noticeTone.value = ok ? 'success' : 'error';
}

async function addLine() {
  const part = catalog.value.find((item) => item.id === inventoryItemId.value);
  busy.value = true;
  const { error: insertError } = await db().from('purchase_order_items').insert({
    purchase_order_id: route.params.id,
    inventory_item_id: inventoryItemId.value || null,
    description: description.value || part?.name || 'Item',
    quantity: Number(quantity.value),
    unit_cost: Number(unitCost.value),
  });
  busy.value = false;
  note(insertError?.message ?? (insertError ? null : 'Line added.'), !insertError);
  if (!insertError) queryClient.invalidateQueries({ queryKey: ['po', route.params.id] });
}

async function setSupplierStatus(next: 'acknowledged' | 'shipped') {
  busy.value = true;
  const { error: updateError } = await db().from('purchase_orders').update({ status: next }).eq('id', route.params.id);
  busy.value = false;
  note(updateError?.message ?? (next === 'shipped' ? 'Order marked shipped.' : 'Order acknowledged.'), !updateError);
  if (!updateError) {
    status.value = next;
    queryClient.invalidateQueries({ queryKey: ['po', route.params.id] });
  }
}

async function saveStatus() {
  if (status.value === 'received') {
    note('Use Receive into stock so the lines are posted to inventory.', false);
    return;
  }
  if (status.value === 'cancelled') {
    const ok = await confirm({ title: 'Cancel order', description: 'Cancel this purchase order?', confirmLabel: 'Cancel order' });
    if (!ok) return;
  }
  busy.value = true;
  const { error: updateError } = await db().from('purchase_orders').update({ status: status.value }).eq('id', route.params.id);
  busy.value = false;
  note(updateError?.message ?? 'Status updated.', !updateError);
  if (!updateError) queryClient.invalidateQueries({ queryKey: ['po', route.params.id] });
}

async function approve() {
  const ok = await confirm({ title: 'Approve order', description: 'Send this purchase order to the supplier?', confirmLabel: 'Approve and send', tone: 'primary' });
  if (!ok) return;
  busy.value = true;
  const { error: updateError } = await db().from('purchase_orders').update({ status: 'sent', approved_by: auth.profile?.id ?? null }).eq('id', route.params.id);
  busy.value = false;
  note(updateError?.message ?? 'Order sent.', !updateError);
  if (!updateError) {
    status.value = 'sent';
    queryClient.invalidateQueries({ queryKey: ['po', route.params.id] });
  }
}

async function receive() {
  const ok = await confirm({ title: 'Receive stock', description: 'Receive these lines into inventory and close the order?', confirmLabel: 'Receive stock', tone: 'primary' });
  if (!ok) return;
  busy.value = true;
  const { error: receiveError } = await db().rpc('receive_purchase_order', { p_id: route.params.id });
  busy.value = false;
  note(receiveError?.message ?? 'Stock received and order closed.', !receiveError);
  if (!receiveError) {
    status.value = 'received';
    queryClient.invalidateQueries({ queryKey: ['po', route.params.id] });
  }
}
</script>
