import { useQuery } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import type { FileType } from '../types'

/**
 * useStorageFiles — list files with optional filters.
 * Migrated from fetchWrapper to useApi().
 */
export function useStorageFiles(filters?: Ref<Record<string, unknown>>) {
  const api = useApi()

  return useQuery({
    queryKey: ['storage', 'files', filters?.value],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (filters?.value) {
        for (const [key, val] of Object.entries(filters.value)) {
          if (val !== undefined && val !== null && val !== '') {
            params[key] = String(val)
          }
        }
      }
      return api.get<FileType[]>('/files', { query: params })
    },
    staleTime: 1000 * 60 * 2,
  })
}
