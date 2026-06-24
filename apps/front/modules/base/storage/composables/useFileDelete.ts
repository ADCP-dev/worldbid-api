import { useMutation, useQueryClient } from '@tanstack/vue-query'

/**
 * useFileDelete — Storage layer composable for deleting files.
 *
 * Migrated from fetchWrapper to useApi() — auth + 401-refresh are
 * now centralized.
 */
export function useFileDelete() {
  const queryClient = useQueryClient()
  const api = useApi()

  return useMutation({
    mutationFn: (id: string) => api.delete(`/files/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage', 'files'] })
      queryClient.invalidateQueries({ queryKey: ['storage', 'stats'] })
      queryClient.refetchQueries({ queryKey: ['storage', 'stats'] })
    },
  })
}
