<template>
  <PageHeader title="Purchase orders" description="Draft an order for a supplier, then open it to add lines." />
  <AppCard title="New draft">
    <form class="grid gap-3 md:grid-cols-3" @submit.prevent="create">
      <AppField label="Supplier" required>
        <select v-model="supplierId" class="field-input" required>
          <option value="">Choose a supplier…</option>
          <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">{{ supplier.name }}</option>
        </select>
      </AppField>
      <AppField label="Notes"><input v-model="notes" class="field-input" /></AppField>
      <div class="flex items-end"><AppButton type="submit" :disabled="saving">{{ saving ? 'Creating…' : 'Create draft' }}</AppButton></div>
    </form>
    <div class="mt-3"><AppNotice tone="error" :message="error" /></div>
  </AppCard>
  <SearchField v-model="term" placeholder="Search order code" @update:model-value="paging.reset()" />
  <SkeletonRows v-if="query.isLoading.value" />
  <AppNotice v-else-if="query.isError.value" tone="error" :message="(query.error.value as Error).message" />
  <EmptyState v-else-if="!filtered.length" :title="term ? 'No orders match that search.' : 'No purchase orders yet.'" />
  <template v-else>
    <SimpleTable :head="['Order', 'Status', 'Total']">
      <tr v-for="row in paging.slice.value" :key="row.id" class="cursor-pointer hover:bg-slate-50" @click="router.push(`/purchase-orders/${row.id}`)">
        <td class="td font-medium text-[#0B4F6C]">{{ row.code ?? 'Draft' }}</td>
        <td class="td"><AppBadge :status="row.status" /></td>
        <td class="td">{{ formatMoney(row.total) }}</td>
      </tr>
    </SimpleTable>
    <PaginationBar :page="paging.page.value" :page-count="paging.pageCount.value" :total="paging.total.value" @update:page="paging.setPage" />
  </template>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { db } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';
import { formatMoney } from '../lib/format';
import { useClientPage } from '../lib/paging';
import PageHeader from '../components/PageHeader.vue';
import AppCard from '../components/AppCard.vue';
import AppField from '../components/AppField.vue';
import AppButton from '../components/AppButton.vue';
import AppNotice from '../components/AppNotice.vue';
import AppBadge from '../components/AppBadge.vue';
import SearchField from '../components/SearchField.vue';
import SkeletonRows from '../components/SkeletonRows.vue';
import EmptyState from '../components/EmptyState.vue';
import SimpleTable from '../components/SimpleTable.vue';
import PaginationBar from '../components/PaginationBar.vue';

const supplierId = ref('');
const notes = ref('');
const error = ref<string | null>(null);
const saving = ref(false);
const term = ref('');
const suppliers = ref<{ id: string; name: string }[]>([]);
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
const filtered = computed(() => (query.data.value ?? []).filter((row) => `${row.code ?? ''} ${row.status}`.toLowerCase().includes(term.value.trim().toLowerCase())));
const paging = useClientPage(filtered);

onMounted(async () => {
  const { data } = await db().from('suppliers').select('id, name').order('name');
  suppliers.value = data ?? [];
});

async function create() {
  if (!supplierId.value) return error.value = 'Choose a supplier.';
  saving.value = true;
  const created = await db().from('purchase_orders').insert({ supplier_id: supplierId.value, notes: notes.value, created_by: auth.profile?.id, status: 'draft' }).select('id').single();
  saving.value = false;
  error.value = created.error?.message ?? null;
  if (created.data) {
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    router.push(`/purchase-orders/${created.data.id}`);
  }
}
</script>
