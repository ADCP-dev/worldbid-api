<script setup lang="ts" generic="TData, TValue">
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  TableState,
  VisibilityState,
} from "@tanstack/vue-table";
import {
  FlexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useVueTable,
} from "@tanstack/vue-table";
import { ref } from "vue";
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


interface TableState {
  sorting: any[];
  columnFilters: any[];
  globalFilter: string;
  columnVisibility: Record<string, boolean>;
  pageIndex: number;
  pageSize: number;
}

const props = defineProps<{
  columns: MyColumnDef<TData, TValue>[];
  data: TData[];
  tableName: string;
}>();

const tableStateStore = useTableStateStore()

const state = computed(() => {
  const raw = tableStateStore[props.tableName] || {};
  return {
    sorting: Array.isArray(raw.sorting) ? raw.sorting : [],
    columnFilters: Array.isArray(raw.columnFilters) ? raw.columnFilters : [],
    globalFilter: typeof raw.globalFilter === 'string' ? raw.globalFilter : '',
    columnVisibility: typeof raw.columnVisibility === 'object' && raw.columnVisibility !== null ? raw.columnVisibility : {},
    pageIndex: typeof raw.pageIndex === 'number' ? raw.pageIndex : 0,
    pageSize: typeof raw.pageSize === 'number' ? raw.pageSize : 10,
  };
});

const defaultTableState = {
  sorting: [],
  columnFilters: [],
  globalFilter: '',
  columnVisibility: {},
  pageIndex: 0,
  pageSize: 10,
};
// When table state changes (e.g., onFilterChange, onPaginationChange, etc.)
function updateTableState(newPartialState: Partial<TableState>) {
  tableStateStore.setTableState(
    props.tableName,
    { ...defaultTableState, ...tableStateStore[props.tableName], ...newPartialState }
  );
}

const clearAllFilters = () => {
  tableStateStore.resetTableState(props.tableName)
  table.setGlobalFilter('')
}

const sorting = ref<SortingState>([]);
const columnFilters = ref<ColumnFiltersState>([]);
const columnVisibility = ref<VisibilityState>({});

const table = useVueTable({
  get data() {
    return props.data;
  },
  get columns() {
    return props.columns;
  },
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
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
    updateTableState({ columnFilters: newFilters });
  },
  onGlobalFilterChange: val => updateTableState({ globalFilter: val }),
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
    // Only pick allowed keys
    updateTableState({
      pageIndex: newPagination.pageIndex,
      pageSize: newPagination.pageSize,
    });
  },
});

const visiblePages = computed(() => {
  const pageCount = table.getPageCount();
  const current = table.getState().pagination.pageIndex;
  const delta = 2;
  let start = Math.max(0, current - delta);
  let end = Math.min(pageCount, current + delta + 1);
  if (end - start < 5) {
    if (start === 0) end = Math.min(pageCount, 5);
    if (end === pageCount) start = Math.max(0, pageCount - 5);
  }
  return Array.from({ length: end - start }, (_, i) => start + i);
});
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center py-4 gap-2">
      <Input class="max-w-sm" placeholder="Buscar..." :model-value="table.getState().globalFilter ?? ''"
        @update:model-value="(val) => table.setGlobalFilter(val)" />
      <Button variant="outline" class="ml-2" @click="clearAllFilters">
        Limpiar filtros
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline" class="ml-auto">
            Columnas
            <ChevronDown class="w-4 h-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuCheckboxItem v-for="column in table
            .getAllColumns()
            .filter((column) => column.getCanHide())" :key="column.id" class="capitalize"
            :model-value="column.getIsVisible()" @update:model-value="(value) => column.toggleVisibility(!!value)">
            {{ column.columnDef?.headerName || column.columnDef?.header }}
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow
            v-for="headerGroup in table.getHeaderGroups().filter(group => group.headers.some(header => header.column.getIsVisible()))"
            :key="headerGroup.id">
            <TableHead v-for="header in headerGroup.headers" :key="header.id">
              <FlexRender v-if="!header.isPlaceholder && header.column.getIsVisible()"
                :render="header.column.columnDef.header" :props="header.getContext()" />
            </TableHead>
          </TableRow>
          <!-- Filter row -->
          <TableRow>
            <TableHead v-for="column in table.getAllLeafColumns().filter(col => col.getIsVisible())" :key="column.id"
              class="py-1">
              <template v-if="column.getCanFilter()">
                <Input v-if="(column.columnDef as MyColumnDef<TData, TValue>)?.filterType === 'number'" type="number"
                  class="max-w-xs"
                  :placeholder="`Filtrar ${(column.columnDef as MyColumnDef<TData, TValue>)?.headerName || column.columnDef?.header}`"
                  :model-value="column.getFilterValue() ?? ''" @update:model-value="(val) => {
                    // Convert empty string to null, otherwise to number
                    const parsed = val === '' ? null : Number(val);
                    column.setFilterValue(parsed);
                  }" />
                <Input v-else-if="(column.columnDef as MyColumnDef<TData, TValue>)?.filterType === 'date'" type="date"
                  class="max-w-xs"
                  :placeholder="`Filtrar ${(column.columnDef as MyColumnDef<TData, TValue>)?.headerName || column.columnDef?.header}`"
                  :model-value="(column.getFilterValue() as Date) ?? ''"
                  @update:model-value="(val) => column.setFilterValue(val)" />
                <select v-else-if="(column.columnDef as MyColumnDef<TData, TValue>)?.filterType === 'select'" :value="typeof column.getFilterValue === 'function'
                    ? column.getFilterValue() ?? ''
                    : ''
                  " @change="
                    (e) =>
                      column.setFilterValue &&
                      column.setFilterValue(e.target.value)
                  "
                  class="max-w-xs w-[120px] px-3 py-2 border border-input dark:bg-zinc-900 bg-zinc-50 rounded-md text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none transition-colors">
                  <option v-for="option in (column.columnDef as MyColumnDef<TData, TValue>)?.options || []"
                    :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
                <select v-else-if="(column.columnDef as MyColumnDef<TData, TValue>)?.filterType === 'boolean'"
                  :value="column.getFilterValue() ?? ''" @change="(e) => {
                    let val = e.target.value;
                    if (val === '') column.setFilterValue('');
                    else if (val === 'true') column.setFilterValue(true);
                    else if (val === 'false') column.setFilterValue(false);
                  }"
                  class="max-w-xs w-[120px] px-3 py-2 border border-input dark:bg-zinc-900 bg-zinc-50 rounded-md text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none transition-colors">
                  <option value="">Todos</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
                <Input v-else class="max-w-xs" :placeholder="`Filtrar ${(column.columnDef as MyColumnDef<TData, TValue>)?.headerName ?? column.columnDef?.header?.toString()
                  }`" :model-value="typeof column.getFilterValue === 'function'
                      ? column.getFilterValue() ?? ''
                      : ''
                    " @update:model-value="
                    (val) => column.setFilterValue && column.setFilterValue(val)
                  " />
              </template>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="table.getRowModel().rows?.length">
            <template v-for="(row, rowIndex) in table.getRowModel().rows" :key="row.id">
              <TableRow :data-state="row.getIsSelected() ? 'selected' : undefined"
                :class="rowIndex % 2 === 0 ? 'bg-muted/50' : ''">
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
          table.getState().pagination.pageIndex *
          table.getState().pagination.pageSize +
          1
        }}
        –
        {{
          Math.min(
            (table.getState().pagination.pageIndex + 1) *
            table.getState().pagination.pageSize,
            table.getFilteredRowModel().rows.length
          )
        }}
        de {{ table.getFilteredRowModel().rows.length }}
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" :disabled="!table.getCanPreviousPage()"
          @click="table.setPageIndex(0)">Primera</Button>
        <Button variant="outline" size="sm" :disabled="!table.getCanPreviousPage()"
          @click="table.previousPage()">Anterior</Button>
        <template v-for="page in visiblePages" :key="page">
          <Button variant="outline" size="sm" :class="{
            'bg-primary text-primary-foreground':
              table.getState().pagination.pageIndex === page,
          }" @click="table.setPageIndex(page)">{{ page + 1 }}</Button>
        </template>
        <Button variant="outline" size="sm" :disabled="!table.getCanNextPage()"
          @click="table.nextPage()">Siguiente</Button>
        <Button variant="outline" size="sm" :disabled="!table.getCanNextPage()"
          @click="table.setPageIndex(table.getPageCount() - 1)">Última</Button>
        <select
          class="max-w-xs w-[120px] px-3 py-2 border border-input bg-background rounded-md text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none transition-colors"
          :value="table.getState().pagination.pageSize" @change="(e) => table.setPageSize(Number(e.target.value))">
          <option v-for="size in [10, 20, 30, 40, 50]" :key="size" :value="size">
            Mostrar {{ size }}
          </option>
        </select>
      </div>
    </div>
  </div>
</template>
