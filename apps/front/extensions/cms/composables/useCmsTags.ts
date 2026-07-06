import type { CmsTag } from '../types/cms'

import { useMutation, useQueryClient } from '@tanstack/vue-query'

export type { CmsTag }

export function useCmsTags() {
  const queryClient = useQueryClient()
  const api = useApi()
  const tags = ref<CmsTag[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchTags = async (
    query: { page?: number; limit?: number; lang?: string } = {},
  ) => {
    loading.value = true
    error.value = null
    try {
      const result = await queryClient.fetchQuery({
        queryKey: ['cms', 'tags', query],
        queryFn: () =>
          api.get<CmsTag[] | { data: CmsTag[] }>('/cms/blog/tags', { query }),
      })
      tags.value = (result as { data?: CmsTag[] }).data || (result as CmsTag[])
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error fetching tags'
      throw e
    } finally {
      loading.value = false
    }
  }

  const fetchTagsPublic = async (lang: string = 'es') => {
    loading.value = true
    error.value = null
    try {
      const result = await queryClient.fetchQuery({
        queryKey: ['cms', 'tags', 'public', lang],
        queryFn: () => api.get<CmsTag[]>('/cms/blog/tags/public', { query: { lang } }),
      })
      tags.value = result || []
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error fetching public tags'
      throw e
    } finally {
      loading.value = false
    }
  }

  const createTagMutation = useMutation({
    mutationFn: (data: Partial<CmsTag> & { lang?: string }) => {
      const { lang = 'es', ...body } = data
      return api.post<CmsTag>('/cms/tags', { ...body, lang })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'tags'] })
    },
  })

  const createTag = async (data: Partial<CmsTag> & { lang?: string }) => {
    loading.value = true
    error.value = null
    try {
      const result = (await createTagMutation.mutateAsync(data)) as CmsTag
      tags.value.unshift(result)
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error creating tag'
      throw e
    } finally {
      loading.value = false
    }
  }

  const updateTagMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<CmsTag> & { lang?: string }
    }) => {
      const { lang = 'es', ...body } = data
      return api.patch<CmsTag>(`/cms/tags/${id}`, { ...body, lang })
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'tags'] })
      queryClient.invalidateQueries({ queryKey: ['cms', 'tags', variables.id] })
    },
  })

  const updateTag = async (
    id: string,
    data: Partial<CmsTag> & { lang?: string },
  ) => {
    loading.value = true
    error.value = null
    try {
      const result = (await updateTagMutation.mutateAsync({ id, data })) as CmsTag
      const index = tags.value.findIndex((t) => t.id === id)
      if (index !== -1) tags.value[index] = result
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error updating tag'
      throw e
    } finally {
      loading.value = false
    }
  }

  const deleteTagMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/cms/tags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'tags'] })
    },
  })

  const deleteTag = async (id: string) => {
    loading.value = true
    error.value = null
    try {
      await deleteTagMutation.mutateAsync(id)
      tags.value = tags.value.filter((t) => t.id !== id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error deleting tag'
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    tags,
    loading,
    error,
    fetchTags,
    fetchTagsPublic,
    createTag,
    updateTag,
    deleteTag,
  }
}
