<template>
  <label class="relative block w-full max-w-sm">
    <span class="sr-only">{{ placeholder }}</span>
    <input :value="modelValue" class="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0B4F6C] focus:ring-2 focus:ring-[#0B4F6C]/20" :placeholder="placeholder" @input="onInput" />
  </label>
</template>

<script setup lang="ts">
defineProps<{ modelValue: string; placeholder?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value);
}
</script>
