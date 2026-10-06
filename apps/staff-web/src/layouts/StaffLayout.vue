<template>
  <div class="flex min-h-screen bg-slate-50 font-sans">
    <aside class="staff-nav w-64 p-4 text-white">
      <p class="mb-4 font-semibold">Lakeview Marine</p>
      <router-link v-for="item in links" :key="item.path" :to="item.path" class="mb-1 block rounded px-3 py-2 text-sm hover:bg-white/10">{{ item.label }}</router-link>
      <button class="mt-6 text-sm" @click="help = !help">Help</button>
      <button class="mt-2 text-sm" @click="signOut">Sign out</button>
    </aside>
    <div class="flex-1">
      <header class="border-b bg-white">
        <Menubar :model="menu">
          <template #end>
            <span class="text-sm">{{ profile?.full_name }} · {{ profile?.role }}</span>
            <span v-if="lowCount > 0" class="ml-3 rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">{{ lowCount }} parts at reorder</span>
          </template>
        </Menubar>
      </header>
      <main class="p-6"><router-view /></main>
    </div>
    <aside v-if="help" class="w-80 border-l bg-white p-4">
      <button @click="help = false">Close</button>
      <h2 class="mt-4 font-semibold">Help</h2>
      <details class="mt-3 text-sm"><summary>How do I receive stock?</summary><p>Open a purchase order, approve it, then receive it into stock.</p></details>
      <details class="mt-3 text-sm"><summary>Walk-in customers</summary><p>Reception records a customer without an account, then books an appointment or request.</p></details>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { UserRole } from '@lmew/shared-types';
import { useAuthStore } from '../stores/auth';
import { db, watch } from '../lib/supabase';

const auth = useAuthStore();
const router = useRouter();
const profile = computed(() => auth.profile);
const lowCount = ref(0);
const help = ref(false);

const catalog: { label: string; path: string; roles: UserRole[] }[] = [
  { label: 'Inventory', path: '/inventory', roles: ['store_manager', 'procurement_officer', 'administrator'] },
  { label: 'Stock movements', path: '/stock-movements', roles: ['store_manager', 'administrator'] },
  { label: 'Suppliers', path: '/suppliers', roles: ['store_manager', 'procurement_officer', 'administrator'] },
  { label: 'Purchase orders', path: '/purchase-orders', roles: ['store_manager', 'procurement_officer', 'administrator'] },
  { label: 'My orders', path: '/my-orders', roles: ['supplier'] },
  { label: 'Appointments', path: '/appointments', roles: ['receptionist', 'administrator'] },
  { label: 'On-behalf request', path: '/service-requests/new', roles: ['receptionist', 'administrator'] },
  { label: 'Walk-in', path: '/walk-in', roles: ['receptionist', 'administrator'] },
  { label: 'Inventory report', path: '/reports/inventory', roles: ['store_manager', 'administrator'] },
  { label: 'Profile', path: '/profile', roles: ['store_manager', 'procurement_officer', 'receptionist', 'supplier', 'administrator'] },
];

const links = computed(() => catalog.filter((item) => profile.value && item.roles.includes(profile.value.role)));
const menu = computed(() => links.value.map((item) => ({ label: item.label, command: () => router.push(item.path) })));

async function refreshLowStock() {
  const { data } = await db().from('inventory_items').select('quantity_on_hand, reorder_level');
  lowCount.value = (data ?? []).filter((row) => Number(row.quantity_on_hand) <= Number(row.reorder_level)).length;
}

let stopWatch: (() => void) | undefined;
onMounted(async () => {
  await refreshLowStock();
  stopWatch = watch('inventory_items', () => { void refreshLowStock(); });
});
onUnmounted(() => stopWatch?.());

async function signOut() {
  await auth.signOut();
  router.push('/login');
}
</script>
