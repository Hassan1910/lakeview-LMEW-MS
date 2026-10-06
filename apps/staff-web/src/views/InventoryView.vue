<template>
  <section>
    <h1 class="mb-4 text-xl font-semibold">Inventory</h1>
    <form class="mb-6 grid gap-2 md:grid-cols-3" @submit.prevent="submit">
      <InputText v-model="name" placeholder="Name" />
      <InputText v-model="sku" placeholder="SKU" />
      <InputText v-model="unitPrice" placeholder="Unit price" />
      <InputText v-model="unitCost" placeholder="Unit cost" />
      <InputText v-model="reorderLevel" placeholder="Reorder level" />
      <InputText v-model="categoryName" placeholder="Category" />
      <Message v-if="formError" severity="error">{{ formError }}</Message>
      <Message v-if="success" severity="success">{{ success }}</Message>
      <Button type="submit" label="Add part" />
    </form>
    <p v-if="query.isLoading.value">Loading…</p>
    <p v-else-if="query.isError.value" class="text-red-600">{{ (query.error.value as Error).message }}</p>
    <p v-else-if="!(query.data.value ?? []).length">No inventory items.</p>
    <DataTable v-else :value="query.data.value" @row-click="open">
      <Column field="sku" header="SKU" />
      <Column field="name" header="Name" />
      <Column field="quantity_on_hand" header="On hand" />
      <Column field="reorder_level" header="Reorder" />
      <Column field="unit_price" header="Price" />
    </DataTable>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { toTypedSchema } from '@vee-validate/zod';
import { useForm } from 'vee-validate';
import { z } from 'zod';
import { db } from '../lib/supabase';

const router = useRouter();
const queryClient = useQueryClient();
const success = ref<string | null>(null);
const schema = toTypedSchema(z.object({
  name: z.string().min(2),
  sku: z.string().min(2),
  unitPrice: z.string().min(1),
  unitCost: z.string().min(1),
  reorderLevel: z.string().min(1),
  categoryName: z.string().min(2),
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

const submit = handleSubmit(async (values) => {
  const price = Number(values.unitPrice);
  const cost = Number(values.unitCost);
  const reorder = Number(values.reorderLevel);
  if ([price, cost, reorder].some((value) => Number.isNaN(value) || value < 0)) return formError.value = 'Price, cost, and reorder level must be numbers';
  const existing = await db().from('inventory_categories').select('id').eq('name', values.categoryName).maybeSingle();
  let categoryId = existing.data?.id as string | undefined;
  if (!categoryId) {
    const created = await db().from('inventory_categories').insert({ name: values.categoryName }).select('id').single();
    if (created.error) return formError.value = created.error.message;
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
  formError.value = error?.message ?? errors.value.name ?? null;
  success.value = error ? null : 'Part saved';
  if (!error) queryClient.invalidateQueries({ queryKey: ['inventory'] });
});

function open(event: { data: { id: string } }) {
  router.push(`/inventory/${event.data.id}`);
}
</script>
