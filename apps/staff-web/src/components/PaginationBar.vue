<template>
  <div v-if="total > 0 && pageCount > 1" class="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
    <p>Page {{ page }} of {{ pageCount }} · {{ total }} records</p>
    <div class="flex gap-2">
      <AppButton variant="secondary" :disabled="page <= 1" @click="emit('update:page', page - 1)">Previous</AppButton>
      <AppButton variant="secondary" :disabled="page >= pageCount" @click="emit('update:page', page + 1)">Next</AppButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppButton from './AppButton.vue';

defineProps<{ page: number; pageCount: number; total: number }>();
const emit = defineEmits<{ 'update:page': [page: number] }>();
</script>
