<template>
  <PageHeader title="My orders" description="Purchase orders sent to your company." />
  <AppNotice tone="error" :message="error" />
  <AppNotice tone="success" :message="success" />
  <SkeletonRows v-if="query.isLoading.value" />
  <AppNotice v-else-if="query.isError.value" tone="error" :message="(query.error.value as Error).message" />
  <EmptyState v-else-if="!(query.data.value ?? []).length" title="No orders have been sent to you yet." />
  <SimpleTable v-else :head="['Order', 'Status', 'Total', '']">
    <tr v-for="order in query.data.value" :key="order.id">
      <td class="td"><router-link class="font-medium text-[#0B4F6C] hover:underline" :to="`/purchase-orders/${order.id}`">{{ order.code }}</router-link></td>
      <td class="td"><AppBadge :status="order.status" /></td>
      <td class="td">{{ formatMoney(order.total) }}</td>
      <td class="td text-right">
        <div class="flex flex-wrap justify-end gap-2">
          <AppButton v-if="order.status === 'sent'" :disabled="busy === order.id" @click="setStatus(order.id, 'acknowledged')">Acknowledge</AppButton>
          <AppButton v-if="order.status === 'sent' || order.status === 'acknowledged'" variant="secondary" :disabled="busy === order.id" @click="setStatus(order.id, 'shipped')">Mark shipped</AppButton>
        </div>
      </td>
    </tr>
  </SimpleTable>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { db } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';
import { confirm } from '../lib/confirm';
import { formatMoney } from '../lib/format';
import PageHeader from '../components/PageHeader.vue';
import AppNotice from '../components/AppNotice.vue';
import AppButton from '../components/AppButton.vue';
import AppBadge from '../components/AppBadge.vue';
import SkeletonRows from '../components/SkeletonRows.vue';
import EmptyState from '../components/EmptyState.vue';
import SimpleTable from '../components/SimpleTable.vue';

const auth = useAuthStore();
const error = ref<string | null>(null);
const success = ref<string | null>(null);
const busy = ref<string | null>(null);
const queryClient = useQueryClient();
const query = useQuery({
  queryKey: ['my-orders', auth.profile?.id],
  queryFn: async () => {
    const supplier = await db().from('suppliers').select('id').eq('profile_id', auth.profile?.id).maybeSingle();
    if (supplier.error) throw supplier.error;
    if (!supplier.data) return [];
    const { data, error: listError } = await db().from('purchase_orders').select('id, code, status, total').eq('supplier_id', supplier.data.id).neq('status', 'draft');
    if (listError) throw listError;
    return data ?? [];
  },
});

async function setStatus(id: string, status: string) {
  const ok = await confirm({
    title: status === 'shipped' ? 'Mark shipped' : 'Acknowledge order',
    description: status === 'shipped' ? 'Tell Lakeview Marine this order has shipped?' : 'Acknowledge that you received this purchase order?',
    confirmLabel: status === 'shipped' ? 'Mark shipped' : 'Acknowledge',
    tone: 'primary',
  });
  if (!ok) return;
  busy.value = id;
  const { error: updateError } = await db().from('purchase_orders').update({ status }).eq('id', id);
  busy.value = null;
  error.value = updateError?.message ?? null;
  success.value = updateError ? null : status === 'shipped' ? 'Marked as shipped.' : 'Order acknowledged.';
  queryClient.invalidateQueries({ queryKey: ['my-orders'] });
}
</script>
