import { useQuery } from '@tanstack/vue-query';
import { fetchWrapper } from '@/helpers/fetch-wrapper';
import type { Ref } from 'vue';
import type { FileType } from '../types';

export function useStorageFiles(filters?: Ref<Record<string, unknown>>) {
  const config = useRuntimeConfig();
  const baseURL = `${config.public.apiUrl}${config.public.apiPrefix}`;

  return useQuery({
    queryKey: ['storage', 'files', filters?.value],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.value) {
        for (const [key, val] of Object.entries(filters.value)) {
          if (val !== undefined && val !== null && val !== '') {
            params.set(key, String(val));
          }
        }
      }
      const query = params.toString();
      return fetchWrapper.get(`${baseURL}/files${query ? '?' + query : ''}`);
    },
    staleTime: 1000 * 60 * 2,
  });
}
