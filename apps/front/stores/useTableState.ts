import { defineStore } from 'pinia'

interface TableState {
  sorting: any[]
  columnFilters: any[]
  globalFilter: string
  columnVisibility: Record<string, boolean>
  pageIndex: number
  pageSize: number
}

interface TablesState {
  [tableName: string]: TableState
}

export const useTableStateStore = defineStore('tableState', {
  state: (): TablesState => ({}),
  actions: {
    setTableState(tableName: string, state: Partial<TableState>) {
      this[tableName] = {
        sorting: Array.isArray(state.sorting) ? state.sorting : [],
        columnFilters: Array.isArray(state.columnFilters) ? state.columnFilters : [],
        globalFilter: typeof state.globalFilter === 'string' ? state.globalFilter : '',
        columnVisibility: typeof state.columnVisibility === 'object' && state.columnVisibility !== null ? state.columnVisibility : {},
        pageIndex: typeof state.pageIndex === 'number' ? state.pageIndex : 0,
        pageSize: typeof state.pageSize === 'number' ? state.pageSize : 10,
      }
    },
    resetTableState(tableName: string) {
      this[tableName] = {
        sorting: [],
        columnFilters: [],
        globalFilter: '',
        columnVisibility: {},
        pageIndex: 0,
        pageSize: 10,
      }
    }
  },
  persist: true,
})