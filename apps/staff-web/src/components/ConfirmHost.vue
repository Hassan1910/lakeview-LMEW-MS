<template>
  <div v-if="confirmState.pending" class="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
    <button class="absolute inset-0 bg-slate-900/40" aria-label="Dismiss" @click="closeConfirm(false)" />
    <div class="relative w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-lg">
      <h2 id="confirm-title" class="text-base font-semibold">{{ confirmState.pending.title }}</h2>
      <p class="mt-2 text-sm text-slate-600">{{ confirmState.pending.description }}</p>
      <div class="mt-4 flex justify-end gap-2">
        <AppButton variant="secondary" @click="closeConfirm(false)">Cancel</AppButton>
        <AppButton :variant="confirmState.pending.tone === 'primary' ? 'primary' : 'danger'" @click="closeConfirm(true)">{{ confirmState.pending.confirmLabel }}</AppButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { closeConfirm, confirmState } from '../lib/confirm';
import AppButton from './AppButton.vue';

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && confirmState.pending) closeConfirm(false);
}
onMounted(() => window.addEventListener('keydown', onKey));
onUnmounted(() => window.removeEventListener('keydown', onKey));
</script>
