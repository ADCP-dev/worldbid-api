import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { fetchWrapper } from '@/helpers/fetch-wrapper';

export function useFileDelete() {
  const queryClient = useQueryClient();
  const config = useRuntimeConfig();
  const baseURL = `${config.public.apiUrl}${config.public.apiPrefix}`;

  return useMutation({
    mutationFn: (id: string) => fetchWrapper.delete(`${baseURL}/files/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage', 'files'] });
      queryClient.invalidateQueries({ queryKey: ['storage', 'stats'] });
      queryClient.refetchQueries({ queryKey: ['storage', 'stats'] });
    },
  });
}
