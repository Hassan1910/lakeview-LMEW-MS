<template>
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 class="text-lg font-semibold tracking-tight text-slate-900">{{ title }}</h1>
      <p v-if="description" class="mt-1 max-w-2xl text-sm text-slate-500">{{ description }}</p>
    </div>
    <div class="flex flex-wrap gap-2"><slot name="actions" /></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>
