<template>
  <label class="block text-sm">
    <span class="mb-1 block font-medium text-slate-700">{{ label }}<span v-if="required" class="text-red-600"> *</span></span>
    <slot />
    <span v-if="hint" class="mt-1 block text-xs text-slate-500">{{ hint }}</span>
  </label>
</template>

<script setup lang="ts">
defineProps<{ label: string; hint?: string; required?: boolean }>();
</script>
