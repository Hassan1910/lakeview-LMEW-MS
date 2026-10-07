<template>
  <SkeletonRows v-if="query.isLoading.value" />
  <AppNotice v-else-if="query.isError.value" tone="error" :message="(query.error.value as Error).message" />
  <template v-else-if="query.data.value">
    <PageHeader :title="query.data.value.name" :description="`SKU ${query.data.value.sku} · ${query.data.value.quantity_on_hand} ${query.data.value.unit ?? ''}`.trim()">
      <template #actions><router-link class="text-sm font-medium text-lmew-blue-800 hover:underline" to="/inventory">Back to inventory</router-link></template>
    </PageHeader>
    <AppCard title="Location">
      <p v-if="query.data.value.description" class="mb-3 text-sm text-slate-600">{{ query.data.value.description }}</p>
      <form class="grid max-w-lg gap-3" @submit.prevent="save">
        <AppField label="Storage location"><input v-model="location" class="field-input" /></AppField>
        <AppButton type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Save location' }}</AppButton>
      </form>
      <div class="mt-3"><AppNotice :tone="error ? 'error' : 'success'" :message="message" /></div>
    </AppCard>
  </template>
  <EmptyState v-else title="Item not found." />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { db } from '../lib/supabase';
import PageHeader from '../components/PageHeader.vue';
import AppCard from '../components/AppCard.vue';
import AppField from '../components/AppField.vue';
import AppButton from '../components/AppButton.vue';
import AppNotice from '../components/AppNotice.vue';
import SkeletonRows from '../components/SkeletonRows.vue';
import EmptyState from '../components/EmptyState.vue';

const route = useRoute();
const location = ref('');
const message = ref<string | null>(null);
const error = ref(false);
const saving = ref(false);
const query = useQuery({
  queryKey: ['inventory-item', route.params.id],
  queryFn: async () => {
    const { data, error: rowError } = await db().from('inventory_items').select('*').eq('id', route.params.id).single();
    if (rowError) throw rowError;
    return data;
  },
});
watch(query.data, (row) => { if (row) location.value = row.location ?? ''; });

async function save() {
  saving.value = true;
  error.value = false;
  const { error: updateError } = await db().from('inventory_items').update({ location: location.value }).eq('id', route.params.id);
  saving.value = false;
  error.value = Boolean(updateError);
  message.value = updateError?.message ?? 'Location saved.';
}
</script>
