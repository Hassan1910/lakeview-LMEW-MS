<template>
  <section class="rounded-lg border border-slate-200 bg-white p-4">
    <div v-if="title" class="mb-3 flex items-center justify-between gap-3">
      <h2 class="text-sm font-semibold text-slate-900">{{ title }}</h2>
      <slot name="action" />
    </div>
    <slot />
  </section>
</template>

<script setup lang="ts">
defineProps<{ title?: string }>();
</script>
