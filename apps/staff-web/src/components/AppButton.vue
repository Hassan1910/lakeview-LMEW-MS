<template>
  <button
    :type="type"
    :disabled="disabled"
    class="inline-flex min-h-9 items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    :class="variant === 'danger'
      ? 'border border-red-700 bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-700'
      : variant === 'secondary'
        ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-lmew-blue-800'
        : 'border border-lmew-blue-800 bg-lmew-blue-800 text-white hover:bg-[#083A50] focus-visible:outline-lmew-blue-800'"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'primary' | 'secondary' | 'danger'; type?: 'button' | 'submit'; disabled?: boolean }>(), {
  variant: 'primary',
  type: 'button',
  disabled: false,
});
</script>
