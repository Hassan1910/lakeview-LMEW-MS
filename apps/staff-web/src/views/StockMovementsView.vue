<template>
  <PageHeader title="Stock movements" description="Record stock in, out, adjustments, and returns." />
  <AppCard title="Record a movement">
    <form class="grid gap-3 md:grid-cols-4" @submit.prevent="record">
      <AppField label="Part" required>
        <select v-model="itemId" class="field-input" required>
          <option value="">Choose a part…</option>
          <option v-for="item in catalog" :key="item.id" :value="item.id">{{ item.name }} ({{ item.sku }})</option>
        </select>
      </AppField>
      <AppField label="Type" required>
        <select v-model="type" class="field-input">
          <option v-for="option in types" :key="option" :value="option">{{ statusLabel(option) }}</option>
        </select>
      </AppField>
      <AppField label="Quantity" required><input v-model="quantity" class="field-input" inputmode="decimal" /></AppField>
      <AppField label="Reason"><input v-model="reason" class="field-input" /></AppField>
      <div><AppButton type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Record movement' }}</AppButton></div>
    </form>
    <div class="mt-3 space-y-2">
      <AppNotice tone="error" :message="error" />
      <AppNotice tone="success" :message="success" />
    </div>
  </AppCard>
  <SkeletonRows v-if="query.isLoading.value" />
  <AppNotice v-else-if="query.isError.value" tone="error" :message="(query.error.value as Error).message" />
  <EmptyState v-else-if="!(query.data.value ?? []).length" title="No movements yet." />
  <template v-else>
    <SimpleTable :head="['When', 'Part', 'Type', 'Qty', { label: 'Reason', className: 'hidden md:table-cell' }]">
      <tr v-for="row in paging.slice.value" :key="row.id">
        <td class="td">{{ formatWhen(row.created_at) }}</td>
        <td class="td">{{ names[row.inventory_item_id] ?? 'Part' }}</td>
        <td class="td"><AppBadge :status="row.type" /></td>
        <td class="td">{{ row.quantity }}</td>
        <td class="td hidden md:table-cell">{{ row.reason || '—' }}</td>
      </tr>
    </SimpleTable>
    <PaginationBar :page="paging.page.value" :page-count="paging.pageCount.value" :total="paging.total.value" @update:page="paging.setPage" />
  </template>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { db } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';
import { formatWhen, statusLabel } from '../lib/format';
import { useClientPage } from '../lib/paging';
import PageHeader from '../components/PageHeader.vue';
import AppCard from '../components/AppCard.vue';
import AppField from '../components/AppField.vue';
import AppButton from '../components/AppButton.vue';
import AppNotice from '../components/AppNotice.vue';
import AppBadge from '../components/AppBadge.vue';
import SkeletonRows from '../components/SkeletonRows.vue';
import EmptyState from '../components/EmptyState.vue';
import SimpleTable from '../components/SimpleTable.vue';
import PaginationBar from '../components/PaginationBar.vue';

const types = ['in', 'out', 'adjustment', 'return'];
const itemId = ref('');
const type = ref('in');
const quantity = ref('1');
const reason = ref('');
const error = ref<string | null>(null);
const success = ref<string | null>(null);
const saving = ref(false);
const catalog = ref<{ id: string; name: string; sku: string }[]>([]);
const auth = useAuthStore();
const queryClient = useQueryClient();

const query = useQuery({
  queryKey: ['movements'],
  queryFn: async () => {
    const { data, error: listError } = await db().from('stock_movements').select('id, created_at, type, quantity, reason, inventory_item_id').order('created_at', { ascending: false });
    if (listError) throw listError;
    return data ?? [];
  },
});
const rows = computed(() => query.data.value ?? []);
const paging = useClientPage(rows);
const names = computed(() => Object.fromEntries(catalog.value.map((item) => [item.id, item.name])));

onMounted(async () => {
  const { data } = await db().from('inventory_items').select('id, name, sku').eq('is_active', true).order('name');
  catalog.value = data ?? [];
});

async function record() {
  error.value = null;
  success.value = null;
  if (!itemId.value) return error.value = 'Choose a part.';
  if (!quantity.value || Number(quantity.value) <= 0) return error.value = 'Enter a quantity greater than zero.';
  saving.value = true;
  const { error: insertError } = await db().from('stock_movements').insert({
    inventory_item_id: itemId.value,
    type: type.value,
    quantity: Number(quantity.value),
    reason: reason.value,
    created_by: auth.profile?.id,
  });
  saving.value = false;
  error.value = insertError?.message ?? null;
  success.value = insertError ? null : 'Movement recorded.';
  if (!insertError) queryClient.invalidateQueries({ queryKey: ['movements'] });
}
</script>
