import { useQuery } from '@tanstack/vue-query';
import { fetchWrapper } from '@/helpers/fetch-wrapper';
import type { FileStats } from '../types';

export function useStorageStats() {
  const config = useRuntimeConfig();
  const baseURL = `${config.public.apiUrl}${config.public.apiPrefix}`;
  return useQuery({
    queryKey: ['storage', 'stats'],
    queryFn: () => fetchWrapper.get(`${baseURL}/files/stats`),
    staleTime: 0, // Always fresh — updates on every upload/delete
  });
}
