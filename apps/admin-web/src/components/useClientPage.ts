import { useState } from 'react';

export function useClientPage<T>(rows: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    setPage,
    pageSize,
    pageCount,
    total: rows.length,
    slice: rows.slice(start, start + pageSize),
  };
}
