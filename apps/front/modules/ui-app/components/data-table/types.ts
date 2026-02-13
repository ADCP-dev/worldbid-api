import type { ColumnDef } from "@tanstack/vue-table";

interface FilterOption {
  value: string | number | boolean;
  label: string;
}

type MyColumnDef<TData, TValue = unknown> = ColumnDef<TData, TValue> & {
  options?: FilterOption[];
  headerName?: string;
  filterType?: 'number' | 'date' | 'string' | 'select' | 'boolean';
};

export type { MyColumnDef };
