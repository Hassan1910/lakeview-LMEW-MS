<template>
  <div class="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
    <p class="text-sm font-medium text-slate-800">{{ title }}</p>
    <p v-if="description" class="mx-auto mt-1 max-w-md text-sm text-slate-500">{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>
