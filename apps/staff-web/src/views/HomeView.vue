<template>
  <PageHeader :title="`Welcome, ${first}`" :description="`${statusLabel(profile?.role)} workspace.`" />
  <SkeletonRows v-if="loading" />
  <AppNotice v-else-if="error" tone="error" :message="error" />
  <template v-else>
    <div v-if="cards.length" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <KpiCard v-for="card in cards" :key="card.label" v-bind="card" />
    </div>
    <AppCard v-if="pending.length" title="Needs attention">
      <ul class="space-y-2 text-sm">
        <li v-for="item in pending" :key="item.to"><router-link class="font-medium text-lmew-blue-800 hover:underline" :to="item.to">{{ item.label }}</router-link></li>
      </ul>
    </AppCard>
    <div class="grid gap-3 lg:grid-cols-2">
      <AppCard v-if="isStore" title="Open purchase orders">
        <p v-if="!openOrders.length" class="text-sm text-slate-500">No open purchase orders.</p>
        <ul v-else class="space-y-2 text-sm">
          <li v-for="order in openOrders" :key="order.id" class="flex items-center justify-between gap-3">
            <router-link class="font-medium text-lmew-blue-800 hover:underline" :to="`/purchase-orders/${order.id}`">{{ order.code ?? 'Draft order' }}</router-link>
            <AppBadge :status="order.status" />
          </li>
        </ul>
      </AppCard>
      <AppCard v-if="isReception" title="Today's appointments">
        <p v-if="!today.length" class="text-sm text-slate-500">Nothing scheduled today.</p>
        <ul v-else class="space-y-2 text-sm">
          <li v-for="row in today" :key="row.id">{{ formatWhen(row.scheduled_at) }} · {{ row.purpose || 'Appointment' }}</li>
        </ul>
      </AppCard>
      <AppCard v-if="isSupplier" title="Orders waiting on you">
        <p v-if="!supplierOrders.length" class="text-sm text-slate-500">No orders have been sent to you yet.</p>
        <ul v-else class="space-y-2 text-sm">
          <li v-for="order in supplierOrders" :key="order.id" class="flex items-center justify-between gap-3">
            <router-link class="font-medium text-lmew-blue-800 hover:underline" :to="`/purchase-orders/${order.id}`">{{ order.code }}</router-link>
            <AppBadge :status="order.status" />
          </li>
        </ul>
      </AppCard>
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { useAuthStore } from '../stores/auth';
import { db } from '../lib/supabase';
import { formatWhen, statusLabel } from '../lib/format';
import PageHeader from '../components/PageHeader.vue';
import SkeletonRows from '../components/SkeletonRows.vue';
import AppNotice from '../components/AppNotice.vue';
import AppCard from '../components/AppCard.vue';
import AppBadge from '../components/AppBadge.vue';
import KpiCard from '../components/KpiCard.vue';

const auth = useAuthStore();
const profile = computed(() => auth.profile);
const role = computed(() => profile.value?.role);
const first = computed(() => profile.value?.full_name?.split(' ')[0] ?? 'there');
const isStore = computed(() => !!role.value && ['store_manager', 'procurement_officer', 'administrator'].includes(role.value));
const isReception = computed(() => !!role.value && ['receptionist', 'administrator'].includes(role.value));
const isSupplier = computed(() => role.value === 'supplier');

const metrics = useQuery({
  queryKey: ['staff-home-metrics'],
  enabled: isStore,
  queryFn: async () => {
    const { data, error } = await db().rpc('dashboard_metrics');
    if (error) throw error;
    const row = (data ?? {}) as { low_stock?: number; open_orders?: number };
    return { low: Number(row.low_stock ?? 0), openOrders: Number(row.open_orders ?? 0) };
  },
});
const orders = useQuery({
  queryKey: ['staff-home-orders'],
  enabled: isStore,
  queryFn: async () => {
    const { data, error } = await db().from('purchase_orders').select('id, code, status').not('status', 'in', '(received,cancelled)').order('created_at', { ascending: false }).limit(5);
    if (error) throw error;
    return data ?? [];
  },
});
const appointments = useQuery({
  queryKey: ['staff-home-appointments'],
  enabled: isReception,
  queryFn: async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const { data, error } = await db().from('appointments').select('id, scheduled_at, purpose, status').gte('scheduled_at', start.toISOString()).lt('scheduled_at', end.toISOString()).order('scheduled_at');
    if (error) throw error;
    return data ?? [];
  },
});
const mine = useQuery({
  queryKey: ['staff-home-mine', profile.value?.id],
  enabled: isSupplier,
  queryFn: async () => {
    const supplier = await db().from('suppliers').select('id').eq('profile_id', profile.value?.id).maybeSingle();
    if (supplier.error) throw supplier.error;
    if (!supplier.data) return [];
    const { data, error } = await db().from('purchase_orders').select('id, code, status').eq('supplier_id', supplier.data.id).neq('status', 'draft');
    if (error) throw error;
    return (data ?? []).filter((row) => !['received', 'cancelled'].includes(row.status));
  },
});

const loading = computed(() => metrics.isLoading.value || orders.isLoading.value || appointments.isLoading.value || mine.isLoading.value);
const error = computed(() => {
  const failed = metrics.error.value ?? orders.error.value ?? appointments.error.value ?? mine.error.value;
  return failed instanceof Error ? failed.message : null;
});
const openOrders = computed(() => (orders.data.value ?? []).slice(0, 5));
const today = computed(() => appointments.data.value ?? []);
const supplierOrders = computed(() => (mine.data.value ?? []).slice(0, 5));
const cards = computed(() => {
  const items: { label: string; value: string | number; to: string; hint?: string }[] = [];
  if (isStore.value) {
    items.push({ label: 'Low stock', value: metrics.data.value?.low ?? 0, to: '/inventory', hint: 'At or below reorder' });
    items.push({ label: 'Open purchase orders', value: metrics.data.value?.openOrders ?? 0, to: '/purchase-orders' });
  }
  if (isReception.value) items.push({ label: "Today's appointments", value: today.value.length, to: '/appointments' });
  if (isSupplier.value) items.push({ label: 'Orders to action', value: mine.data.value?.length ?? 0, to: '/my-orders' });
  return items;
});
const pending = computed(() => {
  const items: { label: string; to: string }[] = [];
  if (isStore.value && (metrics.data.value?.low ?? 0) > 0) items.push({ label: `${metrics.data.value?.low} parts at or below reorder`, to: '/inventory' });
  if (isStore.value && (metrics.data.value?.openOrders ?? 0) > 0) items.push({ label: `${metrics.data.value?.openOrders} purchase orders still open`, to: '/purchase-orders' });
  if (isReception.value && today.value.length > 0) items.push({ label: `${today.value.length} appointments today`, to: '/appointments' });
  if (isSupplier.value && (mine.data.value?.length ?? 0) > 0) items.push({ label: `${mine.data.value?.length} orders waiting on you`, to: '/my-orders' });
  return items;
});
</script>
