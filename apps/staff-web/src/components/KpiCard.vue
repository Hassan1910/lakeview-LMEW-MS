<template>
  <component :is="to ? 'router-link' : 'div'" :to="to" class="block rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300">
    <p class="text-sm text-slate-500">{{ label }}</p>
    <p class="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{{ value }}</p>
    <p v-if="hint" class="mt-1 text-xs text-slate-500">{{ hint }}</p>
  </component>
</template>

<script setup lang="ts">
defineProps<{ label: string; value: string | number; hint?: string; to?: string }>();
</script>
