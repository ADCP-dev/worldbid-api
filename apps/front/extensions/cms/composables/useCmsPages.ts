import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { fetchWrapper } from '@/helpers/fetch-wrapper'

export interface CmsPage {
  id: string
  slug: string
  name?: string
  title: string
  route: string
  section: string
  order: number
  isPublished: boolean
  publishedAt: string | null
  featuredImage?: {
    id: string
    url: string
    name: string
  }
}

export interface CmsPageWithTranslations extends CmsPage {
  translations: {
    title: string
    content: string
    excerpt: string
  }
  seo: {
    metaTitle: string
    metaDescription: string
    metaKeywords: string[]
    ogImage?: { url: string }
  }
}

export interface CmsSeoMetadata {
  id?: string
  pageId: string
  lang: string
  metaTitle: string
  metaDescription: string
  metaKeywords: string[]
  ogImage?: {
    id: string
    url: string
    name: string
  }
  canonicalUrl?: string
}

export function useCmsPages() {
  const queryClient = useQueryClient()
  const runtimeConfig = useRuntimeConfig()
  const baseUrl = `${runtimeConfig.public.apiUrl}${runtimeConfig.public.apiPrefix}`
  const pages = ref<CmsPage[]>([])
  const currentPage = ref<CmsPageWithTranslations | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchPages = async (
    query: { page?: number; limit?: number; published?: boolean } = {},
  ) => {
    loading.value = true
    error.value = null
    try {
      const params = new URLSearchParams()
      if (query.page) params.append('page', String(query.page))
      if (query.limit) params.append('limit', String(query.limit))
      if (query.published !== undefined)
        params.append('isPublished', String(query.published))

      const result = await queryClient.fetchQuery({
        queryKey: ['cms', 'pages', query],
        queryFn: () => fetchWrapper.get(`${baseUrl}/cms/pages?${params}`),
      })
      pages.value = result.data ?? result
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error fetching pages'
      throw e
    } finally {
      loading.value = false
    }
  }

  const fetchPage = async (id: string) => {
    loading.value = true
    error.value = null
    try {
      currentPage.value = await queryClient.fetchQuery({
        queryKey: ['cms', 'pages', id],
        queryFn: () => fetchWrapper.get(`${baseUrl}/cms/pages/${id}`),
      })
      return currentPage.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error fetching page'
      throw e
    } finally {
      loading.value = false
    }
  }

  const createPageMutation = useMutation({
    mutationFn: (data: Partial<CmsPage>) =>
      fetchWrapper.post(`${baseUrl}/cms/pages`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'pages'] })
    },
  })

  const createPage = async (data: Partial<CmsPage>) => {
    loading.value = true
    error.value = null
    try {
      const result = await createPageMutation.mutateAsync(data)
      pages.value.unshift(result)
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error creating page'
      throw e
    } finally {
      loading.value = false
    }
  }

  const updatePageMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CmsPage> }) =>
      fetchWrapper.patch(`${baseUrl}/cms/pages/${id}`, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'pages'] })
      queryClient.invalidateQueries({ queryKey: ['cms', 'pages', variables.id] })
    },
  })

  const updatePage = async (id: string, data: Partial<CmsPage>) => {
    loading.value = true
    error.value = null
    try {
      const result = await updatePageMutation.mutateAsync({ id, data })
      const index = pages.value.findIndex((p) => p.id === id)
      if (index !== -1) pages.value[index] = result
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error updating page'
      throw e
    } finally {
      loading.value = false
    }
  }

  const deletePageMutation = useMutation({
    mutationFn: (id: string) =>
      fetchWrapper.delete(`${baseUrl}/cms/pages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'pages'] })
    },
  })

  const deletePage = async (id: string) => {
    loading.value = true
    error.value = null
    try {
      await deletePageMutation.mutateAsync(id)
      pages.value = pages.value.filter((p) => p.id !== id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error deleting page'
      throw e
    } finally {
      loading.value = false
    }
  }

  const publishPageMutation = useMutation({
    mutationFn: ({
      id,
      isPublished,
    }: {
      id: string
      isPublished: boolean
    }) =>
      fetchWrapper.patch(`${baseUrl}/cms/pages/${id}/publish`, { isPublished }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'pages'] })
      queryClient.invalidateQueries({ queryKey: ['cms', 'pages', variables.id] })
    },
  })

  const publishPage = async (id: string, isPublished: boolean) => {
    loading.value = true
    error.value = null
    try {
      const result = await publishPageMutation.mutateAsync({ id, isPublished })
      const index = pages.value.findIndex((p) => p.id === id)
      if (index !== -1) pages.value[index] = result
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error publishing page'
      throw e
    } finally {
      loading.value = false
    }
  }

  const reorderPagesMutation = useMutation({
    mutationFn: ({
      pageIds,
      parentId,
    }: {
      pageIds: string[]
      parentId: string | null
    }) =>
      fetchWrapper.put(`${baseUrl}/cms/pages/reorder`, { pageIds, parentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'pages'] })
    },
  })

  const reorderPages = async (
    pageIds: string[],
    parentId: string | null,
  ) => {
    loading.value = true
    error.value = null
    try {
      await reorderPagesMutation.mutateAsync({ pageIds, parentId })
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error reordering pages'
      throw e
    } finally {
      loading.value = false
    }
  }

  const fetchSeo = async (pageId: string, lang: string = 'es') => {
    try {
      return await queryClient.fetchQuery({
        queryKey: ['cms', 'seo', pageId, lang],
        queryFn: () => fetchWrapper.get(`${baseUrl}/cms/seo/${pageId}?lang=${lang}`),
      })
    } catch (e) {
      return null
    }
  }

  const updateSeoMutation = useMutation({
    mutationFn: ({
      pageId,
      seo,
      lang,
    }: {
      pageId: string
      seo: Partial<CmsSeoMetadata>
      lang: string
    }) =>
      fetchWrapper.patch(`${baseUrl}/cms/seo/${pageId}?lang=${lang}`, seo),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['cms', 'seo', variables.pageId, variables.lang],
      })
    },
  })

  const updateSeo = async (
    pageId: string,
    seo: Partial<CmsSeoMetadata>,
    lang: string = 'es',
  ) => {
    loading.value = true
    error.value = null
    try {
      const result = await updateSeoMutation.mutateAsync({ pageId, seo, lang })
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error updating SEO'
      throw e
    } finally {
      loading.value = false
    }
  }

  const fetchTranslations = async (category: string, lang: string = 'es') => {
    try {
      const result = await fetchWrapper.get(
        `${baseUrl}/translations?filter[category]=${encodeURIComponent(category)}&filter[lang]=${lang}&limit=100`,
      )
      // Transform grouped response into a flat map: { key: { value: content } }
      const items = result.data || []
      const map: Record<string, { value: string }> = {}
      for (const group of items) {
        for (const t of group.translations || []) {
          if (t.lang?.code === lang || t.langCode === lang) {
            map[t.key] = { value: t.content }
          }
        }
      }
      return map
    } catch (e) {
      return null
    }
  }

  const saveTranslation = async (
    category: string,
    lang: string,
    key: string,
    value: string,
  ) => {
    try {
      return await fetchWrapper.post(`${baseUrl}/translations`, {
        app: 'front',
        category,
        langCode: lang,
        key,
        content: value,
      })
    } catch (e) {
      console.error('Error saving translation:', e)
      throw e
    }
  }

  interface BatchTranslationItem {
    section: string
    key: string
    value: string
  }

  const saveTranslationsBatch = async (
    category: string,
    lang: string,
    items: BatchTranslationItem[],
  ) => {
    return await fetchWrapper.post(`${baseUrl}/translations/dynamic/batch`, {
      category,
      lang,
      translations: items,
    })
  }

  const fetchTranslationsByEntityName = async (
    entityName: string,
    query: { page?: number; limit?: number; search?: string } = {},
  ) => {
    loading.value = true
    error.value = null
    try {
      const params = new URLSearchParams()
      params.append('filter[entityName]', entityName)
      if (query.page) params.append('page', String(query.page))
      if (query.limit) params.append('limit', String(query.limit))
      if (query.search) params.append('search', query.search)

      const result = await queryClient.fetchQuery({
        queryKey: ['cms', 'translations', entityName, query],
        queryFn: () => fetchWrapper.get(`${baseUrl}/translations?${params.toString()}`),
      })
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error fetching translations'
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    pages,
    currentPage,
    loading,
    error,
    fetchPages,
    fetchPage,
    createPage,
    updatePage,
    deletePage,
    publishPage,
    fetchSeo,
    updateSeo,
    fetchTranslations,
    saveTranslation,
    saveTranslationsBatch,
    reorderPages,
    fetchTranslationsByEntityName,
  }
}
