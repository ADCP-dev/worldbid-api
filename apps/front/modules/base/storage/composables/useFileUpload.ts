import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { useAuthStore } from '#imports';
import type { FileUploadMeta } from '../types';

export function useFileUpload() {
  const queryClient = useQueryClient();
  const config = useRuntimeConfig();
  const authStore = useAuthStore();

  return useMutation({
    mutationFn: async ({ file, meta }: { file: File; meta?: FileUploadMeta }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (meta) {
        if (meta.entityName) formData.append('entityName', meta.entityName);
        if (meta.entityId) formData.append('entityId', meta.entityId);
        if (meta.context) formData.append('context', meta.context);
        formData.append('isPublic', String(meta.isPublic ?? true));
      }
      return $fetch(`${config.public.apiUrl}${config.public.apiPrefix}/files/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: `Bearer ${authStore.token}`,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage', 'files'] });
      queryClient.invalidateQueries({ queryKey: ['storage', 'stats'] });
      queryClient.refetchQueries({ queryKey: ['storage', 'stats'] });
    },
  });
}
