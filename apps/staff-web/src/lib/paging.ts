import { computed, ref, type Ref } from 'vue';

export function useClientPage<T>(rows: Ref<T[]>, pageSize = 10) {
  const page = ref(1);
  const pageCount = computed(() => Math.max(1, Math.ceil(rows.value.length / pageSize)));
  const safePage = computed(() => Math.min(page.value, pageCount.value));
  const slice = computed(() => {
    const start = (safePage.value - 1) * pageSize;
    return rows.value.slice(start, start + pageSize);
  });
  function setPage(next: number) {
    page.value = next;
  }
  function reset() {
    page.value = 1;
  }
  return { page: safePage, pageCount, slice, total: computed(() => rows.value.length), setPage, reset };
}
