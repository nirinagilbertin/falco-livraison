import { TableLazyLoadEvent } from 'primeng/table';

export function toPageParams(e: TableLazyLoadEvent) {
  const rows = e.rows ?? 20;
  const first = e.first ?? 0;
  return { page: Math.floor(first / rows) + 1, limit: rows };
}