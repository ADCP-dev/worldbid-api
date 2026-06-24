import { useQuery } from '@tanstack/vue-query'
import type { FileStats } from '../types'

/**
 * useStorageStats — storage statistics query.
 * Migrated from fetchWrapper to useApi().
 */
export function useStorageStats() {
  const api = useApi()
  return useQuery({
    queryKey: ['storage', 'stats'],
    queryFn: () => api.get<FileStats>('/files/stats'),
    staleTime: 0,
  })
}
