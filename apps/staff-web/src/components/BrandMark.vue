<template>
  <svg
    viewBox="0 0 64 64"
    :class="className"
    :role="decorative ? undefined : 'img'"
    :aria-hidden="decorative ? 'true' : undefined"
    :aria-label="decorative ? undefined : title"
  >
    <rect width="64" height="64" rx="14" fill="#0B4F6C" />
    <path d="M8 52q8-6 16 0t16 0 16 0" fill="none" stroke="#01BAEF" stroke-width="3.2" stroke-linecap="round" />
    <path d="M8 58q8-4 16 0t16 0 16 0" fill="none" stroke="#7DD3FC" stroke-width="2.6" stroke-linecap="round" />
    <path fill="#F8FAFC" d="M11 34h42l-7 13H18L11 34z" />
    <circle cx="32" cy="24" r="4.5" fill="#F59E0B" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ className?: string; title?: string; decorative?: boolean }>(), {
  className: 'h-10 w-10',
  title: 'Lakeview Marine',
  decorative: false,
});
</script>
