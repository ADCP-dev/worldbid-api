import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { FileType } from '../types'

/**
 * useFileUpdate — partial update of a file.
 * Migrated from fetchWrapper to useApi().
 */
export function useFileUpdate() {
  const queryClient = useQueryClient()
  const api = useApi()

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<Pick<FileType, 'name' | 'isPublic'>>
    }) => api.patch<FileType>(`/files/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage', 'files'] })
      queryClient.invalidateQueries({ queryKey: ['storage', 'stats'] })
      queryClient.refetchQueries({ queryKey: ['storage', 'stats'] })
    },
  })
}
