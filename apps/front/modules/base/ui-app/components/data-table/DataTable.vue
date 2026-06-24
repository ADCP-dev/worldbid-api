<script setup lang="ts" generic="TData, TValue">
import {
  FlexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useVueTable,
  type ColumnSort,
  type ColumnFilter,
} from "@tanstack/vue-table";
import { ref, computed, watch, onMounted } from "vue";
import { useTableStateStore } from "../../stores/useTableState";
import { ChevronDown } from "lucide-vue-next";
import type { MyColumnDef } from "./types";
// useApi replaces the old fetchWrapper. Imported via #imports.
import DataTableComboboxFilter from "./filters/DataTableComboboxFilter.vue";


interface TableState {
  sorting: ColumnSort[];
  columnFilters: ColumnFilter[];
  globalFilter: string;
  columnVisibility: Record<string, boolean>;
  pageIndex: number;
  pageSize: number;
}

const props = defineProps<{
  columns: MyColumnDef<TData, TValue>[];
  data?: TData[];
  tableName?: string;
  endpoint?: string;
  refreshKey?: number;
  manual?: boolean;
  total?: number;
  meta?: Record<string, unknown>;
}>();

const emit = defineEmits(['edit', 'properties', 'row-click'])

const config = useRuntimeConfig()
const baseURL = `${config.public.apiUrl}${config.public.apiPrefix}`
const tableStateStore = useTableStateStore()

// If tableName is not provided, use endpoint as key
const tableName = computed(() => props.tableName || props.endpoint || 'default')

const state = computed<TableState>(() => {
  const raw = (tableStateStore as Record<string, unknown>)[tableName.value] as Partial<TableState> || {};
  return {
    sorting: Array.isArray(raw.sorting) ? raw.sorting : [],
    columnFilters: Array.isArray(raw.columnFilters) ? raw.columnFilters : [],
    globalFilter: typeof raw.globalFilter === 'string' ? raw.globalFilter : '',
    columnVisibility: typeof raw.columnVisibility === 'object' && raw.columnVisibility !== null ? raw.columnVisibility : {},
    pageIndex: typeof raw.pageIndex === 'number' ? raw.pageIndex : 0,
    pageSize: typeof raw.pageSize === 'number' ? raw.pageSize : 10,
  };
});

const internalData = ref<TData[]>(props.data || []);
const totalCount = ref(props.total || 0);
const loading = ref(false);

const fetchData = async () => {
  // If manual is true, do nothing, data is controlled externally
  if (props.manual) return;

  if (!props.endpoint) {
    internalData.value = props.data || [];
    totalCount.value = internalData.value.length;
    return;
  }

  try {
    loading.value = true;
    const params: Record<string, unknown> = {
      page: state.value.pageIndex + 1,
      limit: state.value.pageSize,
    };

    // Add filters
    if (state.value.columnFilters.length > 0) {
      (params as Record<string, unknown>).filter = {};
      state.value.columnFilters.forEach((f: ColumnFilter) => {
        ((params as Record<string, any>).filter as Record<string, unknown>)[f.id] = f.value;
      });
    }

    if (state.value.globalFilter) {
      (params as Record<string, unknown>).search = state.value.globalFilter;
    }

    // Build the query string with nested filter[] support (NestJS convention).
    // We construct the query string ourselves because useApi serializes
    // object values differently than the back-end expects.
    const queryPairs: string[] = [];
    for (const [key, value] of Object.entries(params)) {
       if (key === 'filter' && typeof value === 'object') {
           for (const [filterKey, filterValue] of Object.entries((value as Record<string, any>))) {
               if (filterValue !== null && filterValue !== undefined && filterValue !== '') {
                  queryPairs.push(`filter[${filterKey}]=${encodeURIComponent(filterValue as string)}`);
               }
           }
       } else if (value !== null && value !== undefined && value !== '') {
           queryPairs.push(`${key}=${encodeURIComponent(value as string)}`);
       }
    }
    const queryString = queryPairs.join('&');
    const separator = props.endpoint.includes('?') ? '&' : '?';

    // Pass the path WITH the query string so useApi doesn't re-serialize.
    // (The baseUrl is added by useApi before the path.)
    const responseData = await api.get<{ data: unknown[]; total?: number; meta?: { total?: number } }>(
      `/${props.endpoint}${separator}${queryString}`,
    );
    internalData.value = responseData.data || [];
    totalCount.value = responseData.total ?? responseData.meta?.total ?? 0;
  } catch (error) {
    console.error('Failed to fetch table data:', error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchData();
});

let fetchTimeout: any = null;

watch([() => props.endpoint, () => props.refreshKey, state], () => {
  if (fetchTimeout) clearTimeout(fetchTimeout);
  fetchTimeout = setTimeout(() => {
    fetchData();
  }, 300);
}, { deep: true });

watch(() => props.data, (newData) => {
  // Update internal data when prop changes
  if (newData) {
      internalData.value = newData;
      if (!props.endpoint && !props.manual) {
           totalCount.value = newData.length;
      }
  }
}, { deep: true });

watch(() => props.total, (newTotal) => {
    if (newTotal !== undefined) {
        totalCount.value = newTotal;
    }
});

const defaultTableState = {
  sorting: [],
  columnFilters: [],
  globalFilter: '',
  columnVisibility: {},
  pageIndex: 0,
  pageSize: 10,
};

function updateTableState(newPartialState: Partial<TableState>) {
  tableStateStore.setTableState(
    tableName.value,
    { ...defaultTableState, ...tableStateStore[tableName.value], ...newPartialState }
  );
}

const clearAllFilters = () => {
  tableStateStore.resetTableState(tableName.value)
}

const hasActiveFilters = computed(() => {
  return state.value.columnFilters.length > 0 || !!state.value.globalFilter;
});

const table = useVueTable({
  get data() {
    return internalData.value as TData[];
  },
  get columns() {
    return props.columns;
  },
  get meta() {
    return {
      onEdit: (data: TData) => emit('edit', data),
      onProperties: (data: TData) => emit('properties', data),
      ...(props.meta || {}),
    };
  },
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  manualPagination: !!props.endpoint || !!props.manual,
  manualFiltering: !!props.endpoint || !!props.manual,
  get pageCount() {
    return (props.endpoint || props.manual) ? Math.ceil(totalCount.value / (state.value.pageSize || 10)) : undefined;
  },
  state: {
    get sorting() { return state.value.sorting; },
    get columnFilters() { return state.value.columnFilters; },
    get globalFilter() { return state.value.globalFilter; },
    get columnVisibility() { return state.value.columnVisibility; },
    get pagination() {
      return {
        pageIndex: state.value.pageIndex,
        pageSize: state.value.pageSize,
      };
    },
  },
  onSortingChange: val => {
    const newSorting = typeof val === 'function'
      ? val(state.value.sorting)
      : val;
    updateTableState({ sorting: newSorting });
  },
  onColumnFiltersChange: val => {
    const newFilters = typeof val === 'function'
      ? val(state.value.columnFilters)
      : val;
    updateTableState({ columnFilters: newFilters, pageIndex: 0 });
  },
  onGlobalFilterChange: val => updateTableState({ globalFilter: val, pageIndex: 0 }),
  onColumnVisibilityChange: val => {
    const newVisibility = typeof val === 'function'
      ? val(state.value.columnVisibility)
      : val;
    updateTableState({ columnVisibility: newVisibility });
  },
  onPaginationChange: val => {
    const newPagination = typeof val === 'function'
      ? val({ pageIndex: state.value.pageIndex, pageSize: state.value.pageSize })
      : val;
    updateTableState({
      pageIndex: newPagination.pageIndex,
      pageSize: newPagination.pageSize,
    });
  },
});

const visiblePages = computed(() => {
  const pageCount = table.getPageCount();
  const current = state.value.pageIndex;
  const delta = 2;
  let start = Math.max(0, current - delta);
  let end = Math.min(pageCount, current + delta + 1);
  if (end - start < 5) {
    if (start === 0) end = Math.min(pageCount, 5);
    if (end === pageCount) start = Math.max(0, pageCount - 5);
  }
  return Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i);
});

defineExpose({
  fetchData
});
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center py-4 gap-2">
      <input
        type="text" class="input input-bordered input-sm max-w-sm" :placeholder="$t('base.app.dataTable.search')"
        :value="table.getState().globalFilter ?? ''"
        @input="(e) => table.setGlobalFilter((e.target as HTMLInputElement).value)" >
      <button
        class="btn btn-sm ml-2"
        :class="hasActiveFilters ? 'btn-primary' : 'btn-outline'"
        @click="clearAllFilters"
      >
        {{ $t('base.app.dataTable.clearFilters') }}
      </button>

      <div class="dropdown dropdown-end ml-auto">
        <label tabindex="0" class="btn btn-outline btn-sm">
          {{ $t('base.app.dataTable.columns') }}
          <ChevronDown class="w-4 h-4 ml-2" />
        </label>
        <ul tabindex="0" class="dropdown-content z-[2] menu p-2 shadow bg-base-100 rounded-box w-52 mt-1">
          <li
            v-for="column in table
            .getAllColumns()
            .filter((column) => column.getCanHide())"
              :key="column.id" class="capitalize">
            <label class="cursor-pointer label justify-start gap-2">
              <input type="checkbox" class="checkbox checkbox-sm" :checked="column.getIsVisible()" @change="(e) => column.toggleVisibility((e.target as HTMLInputElement).checked)" >
              <span class="label-text">{{ (column.columnDef as MyColumnDef<TData, TValue>)?.headerName || column.columnDef?.header }}</span>
            </label>
          </li>
        </ul>
      </div>
    </div>
    <div class="border rounded-md overflow-x-auto bg-base-100">
      <table class="table table-zebra table-sm">
        <thead>
          <tr
            v-for="headerGroup in table.getHeaderGroups().filter(group => group.headers.some(header => header.column.getIsVisible()))"
            :key="headerGroup.id"
          >
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
            >
              <FlexRender
                v-if="!header.isPlaceholder && header.column.getIsVisible()"
                :render="header.column.columnDef.header"
                :props="header.getContext()" />
            </th>
          </tr>
          <!-- Filter row -->
          <tr>
            <th
              v-for="column in table.getAllLeafColumns().filter(col => col.getIsVisible())"
              :key="column.id"
              class="py-1">
              <template v-if="column.getCanFilter() && (column.columnDef as MyColumnDef<TData, TValue>)?.filterType">
                <input
                  v-if="(column.columnDef as MyColumnDef<TData, TValue>)?.filterType === 'number'"
                  type="number"
                  class="input input-sm input-bordered w-full max-w-xs font-normal"
                  :placeholder="`${$t('base.app.dataTable.filterBy')} ${(column.columnDef as MyColumnDef<TData, TValue>)?.headerName || column.columnDef?.header}`"
                  :value="(column.getFilterValue() as number | string) ?? ''" @input="(e) => {
                    const val = (e.target as HTMLInputElement).value;
                    const parsed = val === '' ? null : Number(val);
                    column.setFilterValue(parsed);
                  }" >
                <input
                  v-else-if="(column.columnDef as MyColumnDef<TData, TValue>)?.filterType === 'date'"
                  type="date"
                  class="input input-sm input-bordered w-full max-w-xs font-normal"
                  :placeholder="`${$t('base.app.dataTable.filterBy')} ${(column.columnDef as MyColumnDef<TData, TValue>)?.headerName || column.columnDef?.header}`"
                  :value="(column.getFilterValue() as string) ?? ''"
                  @input="(e) => column.setFilterValue && column.setFilterValue((e.target as HTMLInputElement).value as string)" >
                <DataTableComboboxFilter
                  v-else-if="(column.columnDef as MyColumnDef<TData, TValue>)?.filterType === 'combobox'"
                  :model-value="(column.getFilterValue() as number | string) ?? ''"
                  :options="(column.columnDef as MyColumnDef<TData, TValue>)?.options || []"
                  :placeholder="`${$t('base.app.dataTable.filterBy')} ${(column.columnDef as MyColumnDef<TData, TValue>)?.headerName || ''}`"
                  @update:model-value="(val) => column.setFilterValue && column.setFilterValue(val || null)"
                />
                <select
                  v-else-if="(column.columnDef as MyColumnDef<TData, TValue>)?.filterType === 'select'"
                  :value="(column.getFilterValue() as string) ?? ''"
                  class="select select-sm select-bordered w-full max-w-xs font-normal"
                  @change="
                    (e) =>
                      column.setFilterValue &&
                      column.setFilterValue((e.target as HTMLSelectElement).value)
                  "
                  >
                  <option
                    v-for="option in (column.columnDef as MyColumnDef<TData, TValue>)?.options || []"
                    :key="String(option.value)" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
                <select
                  v-else-if="(column.columnDef as MyColumnDef<TData, TValue>)?.filterType === 'boolean'"
                  :value="(column.getFilterValue() as string) ?? ''"
                  class="select select-sm select-bordered w-full max-w-xs font-normal"
                  @change="(e) => {
                    let val = (e.target as HTMLSelectElement).value;
                    if (val === '') column.setFilterValue('');
                    else if (val === 'true') column.setFilterValue(true);
                    else if (val === 'false') column.setFilterValue(false);
                  }"
                  >
                  <option value="">{{ $t('base.app.dataTable.all') }}</option>
                  <option value="true">{{ $t('base.app.dataTable.yes') }}</option>
                  <option value="false">{{ $t('base.app.dataTable.no') }}</option>
                </select>
                <input
                  v-else class="input input-sm input-bordered w-full max-w-xs font-normal"
                  :placeholder="`${$t('base.app.dataTable.filterBy')} ${(column.columnDef as MyColumnDef<TData, TValue>)?.headerName ?? column.columnDef?.header?.toString()
                  }`"
                  :value="(column.getFilterValue() as string) ?? ''" @input="
                    (e) => column.setFilterValue && column.setFilterValue && column.setFilterValue((e.target as HTMLInputElement).value as string)
                  " >
              </template>
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-if="table.getRowModel().rows?.length">
            <template v-for="(row, rowIndex) in table.getRowModel().rows" :key="row.id">
              <tr
                :class="[rowIndex % 2 === 0 ? 'bg-base-200/50' : '', 'hover cursor-pointer']"
                @click="emit('row-click', row.original)">
                <td v-for="cell in row.getVisibleCells()" :key="cell.id">
                  <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                </td>
              </tr>
            </template>
          </template>
          <template v-else>
            <tr>
              <td :colspan="props.columns.length" class="h-24 text-center">
                {{ $t('base.app.dataTable.noResults') }}
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <div class="flex flex-wrap items-center justify-between py-4">
      <div class="text-sm opacity-70">
        {{ $t('base.app.dataTable.showing') }}
        {{
          totalCount === 0 ? 0 : state.pageIndex * state.pageSize + 1
        }}
        –
        {{
          Math.min(
            (state.pageIndex + 1) *
            state.pageSize,
            totalCount
          )
        }}
        {{ $t('base.app.dataTable.of') }} {{ totalCount }}
      </div>
      <div class="flex flex-wrap items-center gap-2 mt-4 sm:mt-0">
        <button
          class="btn btn-outline btn-sm"
          :disabled="!table.getCanPreviousPage()"
          @click="table.setPageIndex(0)">{{ $t('base.app.dataTable.first') }}</button>
        <button
          class="btn btn-outline btn-sm"
          :disabled="!table.getCanPreviousPage()"
          @click="table.previousPage()">{{ $t('base.app.dataTable.previous') }}</button>
        <template v-for="page in visiblePages" :key="page">
          <button
            class="btn btn-sm"
            :class="table.getState().pagination.pageIndex === page ? 'btn-primary' : 'btn-outline'"
            @click="table.setPageIndex(page)"
          >{{ page + 1 }}</button>
        </template>
        <button
          class="btn btn-outline btn-sm"
          :disabled="!table.getCanNextPage()"
          @click="table.nextPage()">{{ $t('base.app.dataTable.next') }}</button>
        <button
          class="btn btn-outline btn-sm"
          :disabled="!table.getCanNextPage()"
          @click="table.setPageIndex(table.getPageCount() - 1)">{{ $t('base.app.dataTable.last') }}</button>
        <select
          :value="table.getState().pagination.pageSize"
          class="select select-bordered select-sm w-[120px] font-normal"
          @change="(e) => table.setPageSize(Number((e.target as HTMLSelectElement).value))">
          <option v-for="size in [10, 20, 30, 40, 50]" :key="size" :value="size">
            {{ $t('base.app.dataTable.show') }} {{ size }}
          </option>
        </select>
      </div>
    </div>
  </div>
</template>
