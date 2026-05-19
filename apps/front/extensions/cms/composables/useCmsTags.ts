import type { CmsTag } from '../types/cms'

import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { fetchWrapper } from '@/helpers/fetch-wrapper'

export type { CmsTag }

export function useCmsTags() {
  const queryClient = useQueryClient()
  const runtimeConfig = useRuntimeConfig()
  const baseUrl = `${runtimeConfig.public.apiUrl}${runtimeConfig.public.apiPrefix}`
  const tags = ref<CmsTag[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchTags = async (
    query: { page?: number; limit?: number; lang?: string } = {},
  ) => {
    loading.value = true
    error.value = null
    try {
      const params = new URLSearchParams()
      if (query.page) params.append('page', String(query.page))
      if (query.limit) params.append('limit', String(query.limit))
      if (query.lang) params.append('lang', query.lang)

      const result = await queryClient.fetchQuery({
        queryKey: ['cms', 'tags', query],
        queryFn: () => fetchWrapper.get(`${baseUrl}/cms/blog/tags?${params}`),
      })
      tags.value = result.data || result
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
        queryFn: () => fetchWrapper.get(`${baseUrl}/cms/blog/tags/public?lang=${lang}`),
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
      return fetchWrapper.post(`${baseUrl}/cms/tags?lang=${lang}`, body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'tags'] })
    },
  })

  const createTag = async (data: Partial<CmsTag> & { lang?: string }) => {
    loading.value = true
    error.value = null
    try {
      const result = await createTagMutation.mutateAsync(data)
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
      return fetchWrapper.patch(`${baseUrl}/cms/tags/${id}?lang=${lang}`, body)
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
      const result = await updateTagMutation.mutateAsync({ id, data })
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
    mutationFn: (id: string) => fetchWrapper.delete(`${baseUrl}/cms/tags/${id}`),
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
