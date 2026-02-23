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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-vue-next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MyColumnDef } from "./types";
import { fetchWrapper } from "~/helpers/fetch-wrapper";
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

    // Convert params to query string since fetchWrapper.get doesn't accept query params in a body configuration natively
    const queryPairs = [];
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

    const responseData = await fetchWrapper.get(`${baseURL}/${props.endpoint}${separator}${queryString}`);
    // fetchWrapper already parses JSON and returns the body directly
    internalData.value = responseData.data || [];
    totalCount.value = responseData.total ?? 0;
  } catch (error) {
    console.error('Failed to fetch table data:', error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchData();
});

watch([() => props.endpoint, () => props.refreshKey, state], () => {
  fetchData();
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
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center py-4 gap-2">
      <Input class="max-w-sm" placeholder="Buscar..."
        :model-value="table.getState().globalFilter ?? ''"
        @update:model-value="(val) => table.setGlobalFilter(val)" />
      <Button
        variant="outline"
        class="ml-2"
        @click="clearAllFilters"
      >
        Limpiar filtros
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="outline"
            class="ml-auto"
          >
            Columnas
            <ChevronDown class="w-4 h-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuCheckboxItem v-for="column in table
            .getAllColumns()
            .filter((column) => column.getCanHide())"
              :key="column.id" class="capitalize"
            :model-value="column.getIsVisible()"
            @update:model-value="(value) => column.toggleVisibility(!!value)">
            {{ (column.columnDef as MyColumnDef<TData, TValue>)?.headerName || column.columnDef?.header }}
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow
            v-for="headerGroup in table.getHeaderGroups().filter(group => group.headers.some(header => header.column.getIsVisible()))"

            :key="headerGroup.id"
          >
            <TableHead v-for="header in headerGroup.headers"
              :key="header.id"
            >
              <FlexRender
                v-if="!header.isPlaceholder && header.column.getIsVisible()"
                :render="header.column.columnDef.header"
                :props="header.getContext()" />
            </TableHead>
          </TableRow>
          <!-- Filter row -->
          <TableRow>
            <TableHead v-for="column in table.getAllLeafColumns().filter(col => col.getIsVisible())"

              :key="column.id"
              class="py-1">
              <template v-if="column.getCanFilter()">
                <Input v-if="(column.columnDef as MyColumnDef<TData, TValue>)?.filterType === 'number'"
                  type="number"
                  class="max-w-xs"
                  :placeholder="`Filtrar ${(column.columnDef as MyColumnDef<TData, TValue>)?.headerName || column.columnDef?.header}`"
                  :model-value="(column.getFilterValue() as number | string) ?? ''" @update:model-value="(val) => {
                    // Convert empty string to null, otherwise to number
                    const parsed = val === '' ? null : Number(val);
                    column.setFilterValue(parsed);
                  }" />
                <Input v-else-if="(column.columnDef as MyColumnDef<TData, TValue>)?.filterType === 'date'"
                  type="date"
                  class="max-w-xs"
                  :placeholder="`Filtrar ${(column.columnDef as MyColumnDef<TData, TValue>)?.headerName || column.columnDef?.header}`"
                  :model-value="(column.getFilterValue() as string) ?? ''"
                  @update:model-value="(val) => column.setFilterValue && column.setFilterValue(val as string)" />
                <DataTableComboboxFilter
                  v-else-if="(column.columnDef as MyColumnDef<TData, TValue>)?.filterType === 'combobox'"
                  :model-value="(column.getFilterValue() as number | string) ?? ''"
                  :options="(column.columnDef as MyColumnDef<TData, TValue>)?.options || []"
                  :placeholder="`Filtrar ${(column.columnDef as MyColumnDef<TData, TValue>)?.headerName || ''}`"
                  @update:model-value="(val) => column.setFilterValue && column.setFilterValue(val || null)"
                />
                <select v-else-if="(column.columnDef as MyColumnDef<TData, TValue>)?.filterType === 'select'"
                  :value="(column.getFilterValue() as string) ?? ''"
                  class="max-w-xs w-[120px] px-3 py-2 border border-input dark:bg-zinc-900 bg-zinc-50 rounded-md text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                  @change="
                    (e) =>
                      column.setFilterValue &&
                      column.setFilterValue((e.target as HTMLSelectElement).value)
                  "
                  >
                  <option v-for="option in (column.columnDef as MyColumnDef<TData, TValue>)?.options || []"
                    :key="String(option.value)" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
                <select v-else-if="(column.columnDef as MyColumnDef<TData, TValue>)?.filterType === 'boolean'"

                  :value="(column.getFilterValue() as string) ?? ''"
                  class="max-w-xs w-[120px] px-3 py-2 border border-input dark:bg-zinc-900 bg-zinc-50 rounded-md text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                  @change="(e) => {
                    let val = (e.target as HTMLSelectElement).value;
                    if (val === '') column.setFilterValue('');
                    else if (val === 'true') column.setFilterValue(true);
                    else if (val === 'false') column.setFilterValue(false);
                  }"
                  >
                  <option value="">Todos</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
                <Input v-else class="max-w-xs"
                  :placeholder="`Filtrar ${(column.columnDef as MyColumnDef<TData, TValue>)?.headerName ?? column.columnDef?.header?.toString()
                  }`"
                  :model-value="(column.getFilterValue() as string) ?? ''" @update:model-value="
                    (val) => column.setFilterValue && column.setFilterValue && column.setFilterValue(val as string)
                  " />
              </template>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="table.getRowModel().rows?.length">
            <template v-for="(row, rowIndex) in table.getRowModel().rows" :key="row.id">
              <TableRow
                :data-state="row.getIsSelected() ? 'selected' : undefined"
                :class="[rowIndex % 2 === 0 ? 'bg-muted/50' : '', 'cursor-pointer']"
                @click="emit('row-click', row.original)">
                <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id">
                  <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                </TableCell>
              </TableRow>
            </template>
          </template>
          <template v-else>
            <TableRow>
              <TableCell :colspan="props.columns.length" class="h-24 text-center">
                No hay resultados.
              </TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>
    </div>
    <div class="flex flex-wrap items-center justify-between py-4">
      <div class="text-sm text-muted-foreground">
        Mostrando
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
        de {{ totalCount }}
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm"
          :disabled="!table.getCanPreviousPage()"
          @click="table.setPageIndex(0)">Primera</Button>
        <Button variant="outline" size="sm"
          :disabled="!table.getCanPreviousPage()"
          @click="table.previousPage()">Anterior</Button>
        <template v-for="page in visiblePages" :key="page">
          <Button variant="outline" size="sm"
          :class="{
            'bg-primary text-muted-foreground':
              table.getState().pagination.pageIndex === page,
          }"
          @click="table.setPageIndex(page)">{{ page + 1 }}</Button>
        </template>
        <Button variant="outline" size="sm"
          :disabled="!table.getCanNextPage()"
          @click="table.nextPage()">Siguiente</Button>
        <Button variant="outline" size="sm"
          :disabled="!table.getCanNextPage()"
          @click="table.setPageIndex(table.getPageCount() - 1)">Última</Button>
        <select
          :value="table.getState().pagination.pageSize"
          class="max-w-xs w-[120px] px-3 py-2 border border-input bg-background rounded-md text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none transition-colors"
          @change="(e) => table.setPageSize(Number((e.target as HTMLSelectElement).value))">
          <option v-for="size in [10, 20, 30, 40, 50]" :key="size" :value="size">
            Mostrar {{ size }}
          </option>
        </select>
      </div>
    </div>
  </div>
</template>
