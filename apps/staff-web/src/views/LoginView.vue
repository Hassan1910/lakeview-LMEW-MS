<template>
  <main class="flex min-h-screen items-center justify-center bg-slate-50 p-6">
    <form class="w-full max-w-md space-y-3 rounded bg-white p-6 shadow" @submit.prevent="submit">
      <h1 class="text-2xl font-semibold text-[#0B4F6C]">Staff portal</h1>
      <InputText v-model="email" class="w-full" placeholder="Email" />
      <InputText v-model="password" class="w-full" type="password" placeholder="Password" />
      <Message v-if="error" severity="error">{{ error }}</Message>
      <Button type="submit" label="Sign in" :loading="busy" />
    </form>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { LoginSchema } from '@lmew/shared-types';
import { useAuthStore } from '../stores/auth';

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
