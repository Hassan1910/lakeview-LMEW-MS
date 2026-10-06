<template>
  <main class="flex min-h-screen items-center justify-center bg-slate-50 p-6">
    <form class="w-full max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-6" @submit.prevent="submit">
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Lakeview Marine</p>
        <h1 class="mt-1 text-lg font-semibold text-slate-900">Staff sign in</h1>
        <p class="mt-1 text-sm text-slate-500">Store, procurement, reception, and supplier accounts.</p>
      </div>
      <AppField label="Email" required><input v-model="email" class="field-input" type="email" autocomplete="username" /></AppField>
      <AppField label="Password" required><input v-model="password" class="field-input" type="password" autocomplete="current-password" /></AppField>
      <AppNotice tone="error" :message="error" />
      <AppButton type="submit" class="w-full" :disabled="busy">{{ busy ? 'Signing in…' : 'Sign in' }}</AppButton>
    </form>
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
