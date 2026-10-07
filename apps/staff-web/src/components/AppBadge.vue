<template>
  <span class="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium" :class="styles[badgeTone]">
    <slot>{{ label }}</slot>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { statusLabel } from '../lib/format';

const props = withDefaults(defineProps<{ status?: string | null; tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue' }>(), { status: null, tone: undefined });

const resolved = computed(() => {
  if (props.tone) return props.tone;
  const status = props.status ?? '';
  if (['received', 'paid', 'confirmed', 'completed', 'accepted', 'active', 'shipped'].includes(status)) return 'green';
  if (['cancelled', 'rejected', 'failed', 'suspended', 'refunded', 'no_show'].includes(status)) return 'red';
  if (['draft', 'pending'].includes(status)) return 'amber';
  if (!status) return 'slate';
  return 'blue';
});

const label = computed(() => statusLabel(props.status));
const styles = {
  slate: 'bg-slate-100 text-slate-700',
  green: 'bg-emerald-50 text-emerald-800',
  amber: 'bg-amber-50 text-amber-800',
  red: 'bg-red-50 text-red-700',
  blue: 'bg-sky-50 text-sky-800',
};
const badgeTone = resolved;
</script>
