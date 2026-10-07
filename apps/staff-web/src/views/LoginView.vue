<template>
  <main class="flex min-h-screen flex-col lg:flex-row">
    <section class="relative overflow-hidden bg-linear-to-br from-lmew-blue-900 via-[#0A3A56] to-[#0B4F6C] px-6 py-8 text-white sm:px-10 lg:flex lg:w-[46%] lg:items-center lg:px-14 lg:py-16">
      <div class="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#01BAEF]/20 blur-3xl" aria-hidden="true" />
      <svg class="pointer-events-none absolute inset-x-0 bottom-0 h-32 w-full lg:h-44" viewBox="0 0 800 200" preserveAspectRatio="none" aria-hidden="true">
        <path fill="white" fill-opacity="0.06" d="M0 110c90 50 170 50 260 0s170-50 260 0 170 50 280 0v90H0Z" />
        <path fill="#01BAEF" fill-opacity="0.16" d="M0 146c100 36 180 36 270 0s160-36 260 0 150 28 270 8v46H0Z" />
      </svg>
      <div class="relative max-w-md">
        <div class="flex items-center gap-3">
          <BrandMark class-name="h-12 w-12 shrink-0" decorative />
          <div>
            <p class="font-display text-2xl font-semibold leading-none tracking-tight">Lakeview Marine</p>
            <p class="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7DD3FC]">Engineering Works</p>
          </div>
        </div>
        <p class="mt-8 hidden max-w-sm text-sm leading-6 text-sky-100/85 lg:block">
          One secure sign-in for store, procurement, reception, and supplier accounts.
        </p>
      </div>
    </section>
    <section class="flex flex-1 items-start justify-center bg-linear-to-b from-slate-50 to-sky-50/70 px-5 py-8 sm:px-8 lg:items-center lg:py-10">
      <form class="auth-rise w-full max-w-104 space-y-5" @submit.prevent="submit">
        <div>
          <h1 class="font-display text-3xl font-semibold tracking-tight text-slate-900">Staff sign in</h1>
          <p class="mt-2 text-sm leading-6 text-slate-500">Store, procurement, reception, and supplier accounts.</p>
        </div>
        <AppField label="Email" required><input v-model="email" class="field-input" type="email" autocomplete="username" /></AppField>
        <AppField label="Password" required><input v-model="password" class="field-input" type="password" autocomplete="current-password" /></AppField>
        <AppNotice tone="error" :message="error" />
        <AppButton type="submit" class="h-11 w-full text-[15px]" :disabled="busy">{{ busy ? 'Signing in…' : 'Sign in' }}</AppButton>
      </form>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { LoginSchema } from '@lmew/shared-types';
import { useAuthStore } from '../stores/auth';
import AppField from '../components/AppField.vue';
import AppButton from '../components/AppButton.vue';
import AppNotice from '../components/AppNotice.vue';
import BrandMark from '../components/BrandMark.vue';

const email = ref('');
const password = ref('');
const error = ref<string | null>(null);
const busy = ref(false);
const auth = useAuthStore();
const router = useRouter();

async function submit() {
  const parsed = LoginSchema.safeParse({ email: email.value, password: password.value });
  if (!parsed.success) {
    error.value = parsed.error.issues[0]?.message ?? 'Check the form';
    return;
  }
  busy.value = true;
  error.value = await auth.signIn(parsed.data.email, parsed.data.password);
  busy.value = false;
  if (!error.value) router.push('/');
}
</script>
