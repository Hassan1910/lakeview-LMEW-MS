<template>
  <p v-if="message" :role="tone === 'error' ? 'alert' : 'status'" class="rounded-md border px-3 py-2 text-sm" :class="styles[tone]">{{ message }}</p>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'error' | 'success' | 'info' | 'warning'; message?: string | null }>(), { tone: 'info', message: null });

const styles = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
};
</script>
