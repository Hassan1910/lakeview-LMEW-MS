<template>
  <div class="flex min-h-screen bg-slate-50 font-sans text-slate-900">
    <aside :class="[open ? 'translate-x-0' : '-translate-x-full', collapsed ? 'lg:w-16' : 'lg:w-60']" class="fixed inset-y-0 z-30 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0">
      <div class="flex h-14 items-center gap-2 border-b border-slate-200 px-3" :class="collapsed ? 'lg:justify-center' : ''">
        <BrandMark class-name="h-8 w-8 shrink-0" decorative />
        <div :class="collapsed ? 'lg:hidden' : ''">
          <p class="text-sm font-semibold leading-tight">Lakeview Marine</p>
          <p class="text-xs text-slate-500">Staff</p>
        </div>
      </div>
      <nav aria-label="Main" class="flex-1 overflow-y-auto px-2 py-3">
        <div v-for="group in groups" :key="group.label" class="mb-3">
          <p class="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400" :class="collapsed ? 'lg:sr-only' : ''">{{ group.label }}</p>
          <router-link
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            :title="item.label"
            class="mb-0.5 flex items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-100"
            :class="[collapsed ? 'lg:justify-center' : '', isActive(item.path) ? 'bg-lmew-blue-800/10 font-medium text-lmew-blue-800 shadow-[inset_2px_0_0_#0B4F6C]' : '']"
            @click="open = false"
          >
            <component :is="item.icon" class="h-4 w-4 shrink-0" aria-hidden="true" />
            <span class="truncate" :class="collapsed ? 'lg:sr-only' : ''">{{ item.label }}</span>
          </router-link>
        </div>
      </nav>
    </aside>
    <button v-if="open" class="fixed inset-0 z-20 bg-slate-900/40 lg:hidden" aria-label="Close menu" @click="open = false" />
    <div class="flex min-w-0 flex-1 flex-col">
      <header class="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-3">
        <button class="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-slate-100 lg:hidden" aria-label="Open menu" @click="open = true">
          <Menu class="h-4 w-4" />
        </button>
        <button class="hidden h-9 w-9 items-center justify-center rounded-md hover:bg-slate-100 lg:inline-flex" :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'" @click="collapsed = !collapsed">
          <PanelLeftOpen v-if="collapsed" class="h-4 w-4" />
          <PanelLeftClose v-else class="h-4 w-4" />
        </button>
        <span v-if="lowCount > 0" class="hidden rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 sm:inline">{{ lowCount }} parts at reorder</span>
        <div class="relative ml-auto">
          <button class="inline-flex h-9 max-w-56 items-center gap-2 rounded-md px-2 text-sm hover:bg-slate-100" :aria-expanded="menu" aria-haspopup="menu" @click="menu = !menu">
            <UserRound class="h-4 w-4 shrink-0" aria-hidden="true" />
            <span class="truncate">{{ profile?.full_name }}</span>
          </button>
          <div v-if="menu" role="menu" class="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
            <p class="px-2 py-2 text-xs text-slate-500">{{ statusLabel(profile?.role) }}</p>
            <router-link role="menuitem" to="/profile" class="block rounded-md px-2 py-2 text-sm hover:bg-slate-100" @click="menu = false">Profile</router-link>
            <button role="menuitem" class="block w-full rounded-md px-2 py-2 text-left text-sm hover:bg-slate-100" @click="help = true; menu = false">Help</button>
            <button role="menuitem" class="block w-full rounded-md px-2 py-2 text-left text-sm text-red-700 hover:bg-red-50" @click="signOut">Sign out</button>
          </div>
        </div>
      </header>
      <main class="min-w-0 flex-1 space-y-4 p-4 md:p-6">
        <router-view />
      </main>
    </div>
    <div v-if="help" class="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <button class="absolute inset-0 bg-slate-900/40" aria-label="Close help" @click="help = false" />
      <aside class="relative h-full w-full max-w-sm overflow-y-auto border-l border-slate-200 bg-white p-5">
        <div class="flex items-center justify-between">
          <h2 id="help-title" class="text-base font-semibold">Help</h2>
          <button class="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-slate-100" aria-label="Close help" @click="help = false">×</button>
        </div>
        <details class="mt-4 text-sm"><summary class="cursor-pointer font-medium">How do I receive stock?</summary><p class="mt-1 text-slate-600">Open a purchase order, approve it, then receive it into stock.</p></details>
        <details class="mt-3 text-sm"><summary class="cursor-pointer font-medium">Walk-in customers</summary><p class="mt-1 text-slate-600">Reception records a customer without an account, then books an appointment or request.</p></details>
      </aside>
    </div>
    <ConfirmHost />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeftRight, CalendarDays, ClipboardList, FilePlus, LayoutDashboard, Menu, Package, PanelLeftClose, PanelLeftOpen, PieChart, ShoppingCart, Truck, UserPlus, UserRound, type LucideIcon } from '@lucide/vue';
import type { UserRole } from '@lmew/shared-types';
import { useAuthStore } from '../stores/auth';
import { db, watch as watchTable } from '../lib/supabase';
import { statusLabel } from '../lib/format';
import ConfirmHost from '../components/ConfirmHost.vue';
import BrandMark from '../components/BrandMark.vue';

const SIDEBAR_KEY = 'lmew-staff-sidebar';
const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const profile = computed(() => auth.profile);
const lowCount = ref(0);
const help = ref(false);
const open = ref(false);
const menu = ref(false);
const collapsed = ref(localStorage.getItem(SIDEBAR_KEY) === '1');

watch(collapsed, (value) => localStorage.setItem(SIDEBAR_KEY, value ? '1' : '0'));

type Item = { label: string; path: string; roles: UserRole[]; icon: LucideIcon };
const catalog: { label: string; items: Item[] }[] = [
  { label: 'Overview', items: [{ label: 'Home', path: '/', roles: ['store_manager', 'procurement_officer', 'receptionist', 'supplier', 'administrator'], icon: LayoutDashboard }] },
  {
    label: 'Inventory',
    items: [
      { label: 'Inventory', path: '/inventory', roles: ['store_manager', 'procurement_officer', 'administrator'], icon: Package },
      { label: 'Stock movements', path: '/stock-movements', roles: ['store_manager', 'procurement_officer', 'administrator'], icon: ArrowLeftRight },
      { label: 'Inventory report', path: '/reports/inventory', roles: ['store_manager', 'administrator'], icon: PieChart },
    ],
  },
  {
    label: 'Procurement',
    items: [
      { label: 'Suppliers', path: '/suppliers', roles: ['store_manager', 'procurement_officer', 'administrator'], icon: Truck },
      { label: 'Purchase orders', path: '/purchase-orders', roles: ['store_manager', 'procurement_officer', 'administrator'], icon: ShoppingCart },
      { label: 'My orders', path: '/my-orders', roles: ['supplier'], icon: ClipboardList },
    ],
  },
  {
    label: 'Front desk',
    items: [
      { label: 'Appointments', path: '/appointments', roles: ['receptionist', 'administrator'], icon: CalendarDays },
      { label: 'On-behalf request', path: '/service-requests/new', roles: ['receptionist', 'administrator'], icon: FilePlus },
      { label: 'Walk-in', path: '/walk-in', roles: ['receptionist', 'administrator'], icon: UserPlus },
    ],
  },
];

const groups = computed(() => catalog
  .map((group) => ({ ...group, items: group.items.filter((item) => profile.value && item.roles.includes(profile.value.role)) }))
  .filter((group) => group.items.length));

function isActive(path: string) {
  if (path === '/') return route.path === '/';
  return route.path === path || route.path.startsWith(`${path}/`);
}

async function refreshLowStock() {
  if (!profile.value || !['store_manager', 'procurement_officer', 'administrator'].includes(profile.value.role)) return;
  const { data, error } = await db().rpc('low_stock_count');
  if (!error) lowCount.value = Number(data ?? 0);
}

let stopWatch: (() => void) | undefined;
onMounted(async () => {
  await refreshLowStock();
  stopWatch = watchTable('inventory_items', () => { void refreshLowStock(); });
});
onUnmounted(() => stopWatch?.());

async function signOut() {
  await auth.signOut();
  router.push('/login');
}
</script>
