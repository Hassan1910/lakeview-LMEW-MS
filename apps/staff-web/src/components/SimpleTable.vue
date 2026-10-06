<template>
  <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
    <table class="min-w-full text-left text-sm">
      <thead class="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
        <tr>
          <th v-for="(cell, index) in head" :key="index" class="px-3 py-2 font-medium" :class="cellClass(cell)">{{ cellLabel(cell) }}</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <slot />
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
defineProps<{ head: Array<string | { label: string; className?: string }> }>();

function cellLabel(cell: string | { label: string; className?: string }) {
  return typeof cell === 'string' ? cell : cell.label;
}
function cellClass(cell: string | { label: string; className?: string }) {
  return typeof cell === 'string' ? '' : cell.className;
}
</script>
