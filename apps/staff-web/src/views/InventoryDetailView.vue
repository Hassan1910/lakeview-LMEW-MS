<template>
  <section>
    <p v-if="query.isLoading.value">Loading…</p>
    <p v-else-if="query.isError.value" class="text-red-600">{{ (query.error.value as Error).message }}</p>
    <div v-else-if="query.data.value" class="space-y-2">
      <h1 class="text-xl font-semibold">{{ query.data.value.name }}</h1>
      <p>SKU {{ query.data.value.sku }} · {{ query.data.value.quantity_on_hand }} {{ query.data.value.unit }}</p>
      <p>{{ query.data.value.description }}</p>
      <InputText v-model="location" placeholder="Location" />
      <Button label="Save location" @click="save" />
      <Message v-if="message">{{ message }}</Message>
    </div>
    <p v-else>Item not found.</p>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { db } from '../lib/supabase';

const route = useRoute();
const location = ref('');
const message = ref<string | null>(null);
const query = useQuery({
  queryKey: ['inventory-item', route.params.id],
  queryFn: async () => {
    const { data, error } = await db().from('inventory_items').select('*').eq('id', route.params.id).single();
    if (error) throw error;
    return data;
  },
});
watch(query.data, (row) => { if (row) location.value = row.location ?? ''; });

async function save() {
  const { error } = await db().from('inventory_items').update({ location: location.value }).eq('id', route.params.id);
  message.value = error?.message ?? 'Saved';
}
</script>
