<template>
  <section class="max-w-lg space-y-2">
    <h1 class="text-xl font-semibold">Profile</h1>
    <p v-if="!profile">Loading…</p>
    <template v-else>
      <InputText v-model="fullName" />
      <InputText v-model="phone" />
      <Button label="Save" @click="save" />
      <Message v-if="message">{{ message }}</Message>
      <p>Role {{ profile.role }} · {{ profile.is_active ? 'active' : 'disabled' }}</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { db } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const profile = auth.profile;
const fullName = ref(profile?.full_name ?? '');
const phone = ref(profile?.phone ?? '');
const message = ref<string | null>(null);
watch(() => auth.profile, (next) => {
  fullName.value = next?.full_name ?? '';
  phone.value = next?.phone ?? '';
});

async function save() {
  if (!auth.profile) return;
  const { error } = await db().from('profiles').update({ full_name: fullName.value, phone: phone.value }).eq('id', auth.profile.id);
  message.value = error?.message ?? 'Profile saved';
}
</script>
