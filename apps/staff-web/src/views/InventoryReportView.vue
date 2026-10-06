<template>
  <section>
    <h1 class="mb-4 text-xl font-semibold">Inventory report</h1>
    <p v-if="query.isLoading.value">Loading…</p>
    <p v-else-if="query.isError.value" class="text-red-600">{{ (query.error.value as Error).message }}</p>
    <p v-else-if="!(query.data.value ?? []).length">No stock to chart.</p>
    <Bar v-else :data="chart" :options="{ responsive: true, plugins: { legend: { display: false } } }" />
    <Button class="mt-4" label="Export CSV" @click="csv" />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Bar } from 'vue-chartjs';
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from 'chart.js';
import { useQuery } from '@tanstack/vue-query';
import { db } from '../lib/supabase';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

const query = useQuery({
  queryKey: ['inventory-report'],
  queryFn: async () => {
    const { data, error } = await db().from('inventory_items').select('name, quantity_on_hand, reorder_level').order('name');
    if (error) throw error;
    return data ?? [];
  },
});

const chart = computed(() => ({
  labels: (query.data.value ?? []).map((row) => row.name),
  datasets: [{ data: (query.data.value ?? []).map((row) => Number(row.quantity_on_hand)), backgroundColor: '#0B4F6C' }],
}));

function csv() {
  const lines = ['name,quantity_on_hand,reorder_level', ...(query.data.value ?? []).map((row) => `${row.name},${row.quantity_on_hand},${row.reorder_level}`)];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'inventory.csv';
  link.click();
}
</script>
