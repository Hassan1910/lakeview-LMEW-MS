<template>
  <div class="space-y-2" aria-busy="true" aria-live="polite">
    <span class="sr-only">Loading</span>
    <div v-for="index in rows" :key="index" class="h-10 animate-pulse rounded-md bg-slate-200" />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ rows?: number }>(), { rows: 4 });
</script>
