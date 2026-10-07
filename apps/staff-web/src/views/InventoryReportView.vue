<template>
  <PageHeader title="Inventory report" description="On-hand quantities. Bars in amber are at or below reorder.">
    <template #actions><AppButton variant="secondary" @click="csv">Export CSV</AppButton></template>
  </PageHeader>
  <SkeletonRows v-if="query.isLoading.value" />
  <AppNotice v-else-if="query.isError.value" tone="error" :message="(query.error.value as Error).message" />
  <EmptyState v-else-if="!(query.data.value ?? []).length" title="No stock to chart." />
  <AppCard v-else title="Quantity on hand">
    <div class="h-80">
      <Bar :data="chart" :options="{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }" />
    </div>
  </AppCard>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Bar } from 'vue-chartjs';
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from 'chart.js';
import { useQuery } from '@tanstack/vue-query';
import { db } from '../lib/supabase';
import PageHeader from '../components/PageHeader.vue';
import AppButton from '../components/AppButton.vue';
import AppCard from '../components/AppCard.vue';
import AppNotice from '../components/AppNotice.vue';
import SkeletonRows from '../components/SkeletonRows.vue';
import EmptyState from '../components/EmptyState.vue';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

const query = useQuery({
  queryKey: ['inventory-report'],
  queryFn: async () => {
    const { data, error } = await db().from('inventory_items').select('name, quantity_on_hand, reorder_level').order('name');
    if (error) throw error;
    return data ?? [];
  },
});

const chart = computed(() => {
  const rows = (query.data.value ?? []).slice(0, 24);
  return {
    labels: rows.map((row) => row.name),
    datasets: [{
      data: rows.map((row) => Number(row.quantity_on_hand)),
      backgroundColor: rows.map((row) => Number(row.quantity_on_hand) <= Number(row.reorder_level) ? '#D97706' : '#0B4F6C'),
    }],
  };
});

function csv() {
  const lines = ['name,quantity_on_hand,reorder_level', ...(query.data.value ?? []).map((row) => `${row.name},${row.quantity_on_hand},${row.reorder_level}`)];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'inventory.csv';
  link.click();
}
</script>
