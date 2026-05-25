import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { fetchWrapper } from '@/helpers/fetch-wrapper';
import type { FileType } from '../types';

export function useFileUpdate() {
  const queryClient = useQueryClient();
  const config = useRuntimeConfig();
  const baseURL = `${config.public.apiUrl}${config.public.apiPrefix}`;

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<FileType, 'name' | 'isPublic'>> }) =>
      fetchWrapper.patch(`${baseURL}/files/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage', 'files'] });
      queryClient.invalidateQueries({ queryKey: ['storage', 'stats'] });
      queryClient.refetchQueries({ queryKey: ['storage', 'stats'] });
    },
  });
}
