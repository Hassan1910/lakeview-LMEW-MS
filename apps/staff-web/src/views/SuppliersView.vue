<template>
  <PageHeader title="Suppliers" description="Companies you buy parts from." />
  <AppCard :title="editing ? 'Edit supplier' : 'Add a supplier'">
    <form class="grid gap-3 md:grid-cols-3" @submit.prevent="create">
      <AppField label="Name" required><input v-model="form.name" class="field-input" required /></AppField>
      <AppField label="Phone"><input v-model="form.phone" class="field-input" /></AppField>
      <AppField label="Email"><input v-model="form.email" class="field-input" type="email" /></AppField>
      <div class="flex flex-wrap gap-2 md:col-span-3">
        <AppButton type="submit" :disabled="saving">{{ saving ? 'Saving…' : editing ? 'Save supplier' : 'Add supplier' }}</AppButton>
        <AppButton v-if="editing" variant="secondary" type="button" @click="reset">Cancel</AppButton>
      </div>
    </form>
    <div class="mt-3 space-y-2">
      <AppNotice tone="error" :message="error" />
      <AppNotice tone="success" :message="success" />
    </div>
  </AppCard>
  <SearchField v-model="term" placeholder="Search suppliers" @update:model-value="paging.reset()" />
  <SkeletonRows v-if="query.isLoading.value" />
  <AppNotice v-else-if="query.isError.value" tone="error" :message="(query.error.value as Error).message" />
  <EmptyState v-else-if="!filtered.length" :title="term ? 'No suppliers match that search.' : 'No suppliers yet.'" />
  <template v-else>
    <SimpleTable :head="['Name', 'Phone', { label: 'Email', className: 'hidden md:table-cell' }, 'Status', '']">
      <tr v-for="row in paging.slice.value" :key="row.id">
        <td class="td font-medium">{{ row.name }}</td>
        <td class="td">{{ row.phone || '—' }}</td>
        <td class="td hidden md:table-cell">{{ row.email || '—' }}</td>
        <td class="td"><AppBadge :status="row.is_active ? 'active' : 'suspended'" /></td>
        <td class="td text-right"><AppButton variant="secondary" @click="edit(row)">Edit</AppButton></td>
      </tr>
    </SimpleTable>
    <PaginationBar :page="paging.page.value" :page-count="paging.pageCount.value" :total="paging.total.value" @update:page="paging.setPage" />
  </template>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { db } from '../lib/supabase';
import { useClientPage } from '../lib/paging';
import PageHeader from '../components/PageHeader.vue';
import AppCard from '../components/AppCard.vue';
import AppField from '../components/AppField.vue';
import AppButton from '../components/AppButton.vue';
import AppNotice from '../components/AppNotice.vue';
import AppBadge from '../components/AppBadge.vue';
import SearchField from '../components/SearchField.vue';
import SkeletonRows from '../components/SkeletonRows.vue';
import EmptyState from '../components/EmptyState.vue';
import SimpleTable from '../components/SimpleTable.vue';
import PaginationBar from '../components/PaginationBar.vue';

const form = reactive({ name: '', phone: '', email: '' });
const editing = ref<string | null>(null);
const error = ref<string | null>(null);
const success = ref<string | null>(null);
const saving = ref(false);
const term = ref('');
const queryClient = useQueryClient();
const query = useQuery({
  queryKey: ['suppliers'],
  queryFn: async () => {
    const { data, error: listError } = await db().from('suppliers').select('id, name, phone, email, is_active').order('name');
    if (listError) throw listError;
    return data ?? [];
  },
});
const filtered = computed(() => (query.data.value ?? []).filter((row) => `${row.name} ${row.phone ?? ''} ${row.email ?? ''}`.toLowerCase().includes(term.value.trim().toLowerCase())));
const paging = useClientPage(filtered);

function edit(row: { id: string; name: string; phone: string | null; email: string | null }) {
  editing.value = row.id;
  form.name = row.name;
  form.phone = row.phone ?? '';
  form.email = row.email ?? '';
  success.value = null;
}

function reset() {
  editing.value = null;
  form.name = '';
  form.phone = '';
  form.email = '';
}

async function create() {
  if (form.name.trim().length < 2) return error.value = 'Enter the supplier name.';
  saving.value = true;
  error.value = null;
  success.value = null;
  const payload = { name: form.name.trim(), phone: form.phone, email: form.email };
  const result = editing.value
    ? await db().from('suppliers').update(payload).eq('id', editing.value)
    : await db().from('suppliers').insert(payload);
  saving.value = false;
  error.value = result.error?.message ?? null;
  if (!result.error) {
    success.value = editing.value ? 'Supplier saved.' : 'Supplier added.';
    reset();
    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
  }
}
</script>
