<template>
  <PageHeader title="Inventory" description="Parts on hand and the reorder point for each one." />
  <AppCard title="Add a part">
    <form class="grid gap-3 md:grid-cols-3" @submit.prevent="submit">
      <AppField label="Name" required><input v-model="name" class="field-input" /></AppField>
      <AppField label="SKU" required><input v-model="sku" class="field-input" /></AppField>
      <AppField label="Category" required><input v-model="categoryName" class="field-input" /></AppField>
      <AppField label="Unit price" required><input v-model="unitPrice" class="field-input" inputmode="decimal" /></AppField>
      <AppField label="Unit cost" required><input v-model="unitCost" class="field-input" inputmode="decimal" /></AppField>
      <AppField label="Reorder level" required><input v-model="reorderLevel" class="field-input" inputmode="numeric" /></AppField>
      <div class="md:col-span-3"><AppButton type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Add part' }}</AppButton></div>
    </form>
    <div class="mt-3 space-y-2">
      <AppNotice tone="error" :message="formError" />
      <AppNotice tone="success" :message="success" />
    </div>
  </AppCard>
  <SearchField v-model="term" placeholder="Search name or SKU" @update:model-value="paging.reset()" />
  <SkeletonRows v-if="query.isLoading.value" />
  <AppNotice v-else-if="query.isError.value" tone="error" :message="(query.error.value as Error).message" />
  <EmptyState v-else-if="!filtered.length" :title="term ? 'No parts match that search.' : 'No inventory items yet.'" />
  <template v-else>
    <SimpleTable :head="['SKU', 'Name', 'On hand', 'Reorder', { label: 'Price', className: 'hidden sm:table-cell' }]">
      <tr v-for="row in paging.slice.value" :key="row.id" class="cursor-pointer hover:bg-slate-50" @click="open(row.id)">
        <td class="td font-medium text-slate-900">{{ row.sku }}</td>
        <td class="td">{{ row.name }}</td>
        <td class="td">{{ row.quantity_on_hand }}</td>
        <td class="td">{{ row.reorder_level }}</td>
        <td class="td hidden sm:table-cell">{{ formatMoney(row.unit_price) }}</td>
      </tr>
    </SimpleTable>
    <PaginationBar :page="paging.page.value" :page-count="paging.pageCount.value" :total="paging.total.value" @update:page="paging.setPage" />
  </template>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { toTypedSchema } from '@vee-validate/zod';
import { useForm } from 'vee-validate';
import { z } from 'zod';
import { db } from '../lib/supabase';
import { formatMoney } from '../lib/format';
import { useClientPage } from '../lib/paging';
import PageHeader from '../components/PageHeader.vue';
import AppCard from '../components/AppCard.vue';
import AppField from '../components/AppField.vue';
import AppButton from '../components/AppButton.vue';
import AppNotice from '../components/AppNotice.vue';
import SearchField from '../components/SearchField.vue';
import SkeletonRows from '../components/SkeletonRows.vue';
import EmptyState from '../components/EmptyState.vue';
import SimpleTable from '../components/SimpleTable.vue';
import PaginationBar from '../components/PaginationBar.vue';

const router = useRouter();
const queryClient = useQueryClient();
const success = ref<string | null>(null);
const saving = ref(false);
const term = ref('');
const schema = toTypedSchema(z.object({
  name: z.string().min(2, 'Name needs at least 2 characters'),
  sku: z.string().min(2, 'SKU needs at least 2 characters'),
  unitPrice: z.string().min(1, 'Enter a unit price'),
  unitCost: z.string().min(1, 'Enter a unit cost'),
  reorderLevel: z.string().min(1, 'Enter a reorder level'),
  categoryName: z.string().min(2, 'Category needs at least 2 characters'),
}));
const { handleSubmit, defineField, errors } = useForm({ validationSchema: schema });
const [name] = defineField('name');
const [sku] = defineField('sku');
const [unitPrice] = defineField('unitPrice');
const [unitCost] = defineField('unitCost');
const [reorderLevel] = defineField('reorderLevel');
const [categoryName] = defineField('categoryName');
const formError = ref<string | null>(null);

const query = useQuery({
  queryKey: ['inventory'],
  queryFn: async () => {
    const { data, error } = await db().from('inventory_items').select('id, sku, name, quantity_on_hand, reorder_level, unit_price').order('name');
    if (error) throw error;
    return data ?? [];
  },
});
const filtered = computed(() => (query.data.value ?? []).filter((row) => `${row.sku} ${row.name}`.toLowerCase().includes(term.value.trim().toLowerCase())));
const paging = useClientPage(filtered);

const submit = handleSubmit(async (values) => {
  const price = Number(values.unitPrice);
  const cost = Number(values.unitCost);
  const reorder = Number(values.reorderLevel);
  if ([price, cost, reorder].some((value) => Number.isNaN(value) || value < 0)) return formError.value = 'Price, cost, and reorder level must be numbers.';
  saving.value = true;
  const existing = await db().from('inventory_categories').select('id').eq('name', values.categoryName).maybeSingle();
  let categoryId = existing.data?.id as string | undefined;
  if (!categoryId) {
    const created = await db().from('inventory_categories').insert({ name: values.categoryName }).select('id').single();
    if (created.error) {
      saving.value = false;
      return formError.value = created.error.message;
    }
    categoryId = created.data.id;
  }
  const { error } = await db().from('inventory_items').insert({
    name: values.name,
    sku: values.sku,
    unit_price: price,
    unit_cost: cost,
    reorder_level: reorder,
    category_id: categoryId,
  });
  saving.value = false;
  formError.value = error?.message ?? errors.value.name ?? null;
  success.value = error ? null : 'Part saved.';
  if (!error) queryClient.invalidateQueries({ queryKey: ['inventory'] });
});

function open(id: string) {
  router.push(`/inventory/${id}`);
}
</script>
