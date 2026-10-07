<template>
  <PageHeader title="Profile" description="Your name and phone on this account." />
  <SkeletonRows v-if="!profile" />
  <AppCard v-else>
    <form class="grid max-w-lg gap-3" @submit.prevent="save">
      <AppField label="Full name" required><input v-model="fullName" class="field-input" /></AppField>
      <AppField label="Phone"><input v-model="phone" class="field-input" /></AppField>
      <p class="text-sm text-slate-500">{{ statusLabel(profile.role) }} · {{ profile.is_active ? 'Active' : 'Disabled' }}</p>
      <AppButton type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Save profile' }}</AppButton>
    </form>
    <div class="mt-3"><AppNotice :tone="failed ? 'error' : 'success'" :message="message" /></div>
  </AppCard>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { db } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';
import { statusLabel } from '../lib/format';
import PageHeader from '../components/PageHeader.vue';
import AppCard from '../components/AppCard.vue';
import AppField from '../components/AppField.vue';
import AppButton from '../components/AppButton.vue';
import AppNotice from '../components/AppNotice.vue';
import SkeletonRows from '../components/SkeletonRows.vue';

const auth = useAuthStore();
const profile = computed(() => auth.profile);
const fullName = ref(auth.profile?.full_name ?? '');
const phone = ref(auth.profile?.phone ?? '');
const message = ref<string | null>(null);
const failed = ref(false);
const saving = ref(false);
watch(() => auth.profile, (next) => {
  fullName.value = next?.full_name ?? '';
  phone.value = next?.phone ?? '';
});

async function save() {
  if (!auth.profile) return;
  if (fullName.value.trim().length < 2) {
    failed.value = true;
    message.value = 'Enter your full name.';
    return;
  }
  saving.value = true;
  const { error } = await db().from('profiles').update({ full_name: fullName.value.trim(), phone: phone.value }).eq('id', auth.profile.id);
  saving.value = false;
  failed.value = Boolean(error);
  message.value = error?.message ?? 'Profile saved.';
  if (!error) auth.profile.full_name = fullName.value.trim();
}
</script>
