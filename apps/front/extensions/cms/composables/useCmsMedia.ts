import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { useAuthStore } from '#imports';
import { ref } from 'vue';

/**
 * useCmsMedia — Media library composable for the CMS extension.
 * Wraps the backend CMS media endpoints:
 *   GET  /cms/media            → list media files (optionally by entity)
 *   POST /cms/media/upload     → upload a media file (multipart)
 */
export interface CmsMediaFile {
  id: string;
  url: string;
  name: string;
  entityName?: string | null;
  entityId?: string | null;
  type?: string;
  size?: number;
  createdAt?: string;
}

export interface CmsMediaUploadMeta {
  entityName?: string;
  entityId?: string;
  context?: string;
  isPublic?: boolean;
}

export function useCmsMedia() {
  const api = useApi();
  const queryClient = useQueryClient();
  const config = useRuntimeConfig();
  const authStore = useAuthStore();

  const media = ref<CmsMediaFile[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  function isMediaArray(v: unknown): v is CmsMediaFile[] {
    return Array.isArray(v);
  }

  function unwrapList(res: unknown): CmsMediaFile[] {
    if (isMediaArray(res)) return res;
    if (res && typeof res === 'object' && 'data' in res) {
      const data = (res as { data: unknown }).data;
      if (isMediaArray(data)) return data;
    }
    return [];
  }

  /**
   * Fetch media files. Optionally filter by entityName / entityId.
   */
  async function getMedia(entityName?: string, entityId?: string): Promise<CmsMediaFile[]> {
    loading.value = true;
    error.value = null;
    try {
      const query: Record<string, string | undefined> = {};
      if (entityName) query.entityName = entityName;
      if (entityId) query.entityId = entityId;
      const res = await queryClient.fetchQuery({
        queryKey: ['cms', 'media', { entityName, entityId }],
        queryFn: () => api.get<unknown>('/cms/media', { query }),
      });
      const list = unwrapList(res);
      media.value = list;
      return list;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error cargando media';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  const uploadMutation = useMutation({
    mutationFn: async ({
      file,
      meta,
    }: {
      file: File;
      meta?: CmsMediaUploadMeta;
    }) => {
      const baseUrl = `${config.public.apiUrl}${config.public.apiPrefix}`;
      const formData = new FormData();
      formData.append('file', file);
      if (meta) {
        if (meta.entityName) formData.append('entityName', meta.entityName);
        if (meta.entityId) formData.append('entityId', meta.entityId);
        if (meta.context) formData.append('context', meta.context);
        formData.append('isPublic', String(meta.isPublic ?? true));
      }
      return $fetch<CmsMediaFile>(`${baseUrl}/cms/media/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: `Bearer ${authStore.token}`,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'media'] });
    },
  });

  async function uploadMedia(
    file: File,
    meta?: CmsMediaUploadMeta,
  ): Promise<CmsMediaFile> {
    const result = (await uploadMutation.mutateAsync({ file, meta })) as CmsMediaFile;
    return result;
  }

  return {
    media,
    loading,
    error,
    getMedia,
    uploadMedia,
    uploadMutation,
  };
}