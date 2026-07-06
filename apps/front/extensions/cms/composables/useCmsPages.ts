import { useMutation, useQueryClient } from '@tanstack/vue-query'

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
  const api = useApi()
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
      const result = await queryClient.fetchQuery({
        queryKey: ['cms', 'pages', query],
        queryFn: () =>
          api.get<CmsPage[] | { data: CmsPage[] }>('/cms/pages', {
            query: {
              page: query.page,
              limit: query.limit,
              isPublished: query.published,
            },
          }),
      })
      pages.value = (result as { data?: CmsPage[] }).data ?? (result as CmsPage[])
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
        queryFn: () => api.get<CmsPageWithTranslations>(`/cms/pages/${id}`),
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
      api.post<CmsPage>('/cms/pages', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'pages'] })
    },
  })

  const createPage = async (data: Partial<CmsPage>) => {
    loading.value = true
    error.value = null
    try {
      const result = (await createPageMutation.mutateAsync(data)) as CmsPage
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
      api.patch<CmsPage>(`/cms/pages/${id}`, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'pages'] })
      queryClient.invalidateQueries({ queryKey: ['cms', 'pages', variables.id] })
    },
  })

  const updatePage = async (id: string, data: Partial<CmsPage>) => {
    loading.value = true
    error.value = null
    try {
      const result = (await updatePageMutation.mutateAsync({ id, data })) as CmsPage
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
    mutationFn: (id: string) => api.delete(`/cms/pages/${id}`),
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
      api.patch<CmsPage>(`/cms/pages/${id}/publish`, { isPublished }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'pages'] })
      queryClient.invalidateQueries({ queryKey: ['cms', 'pages', variables.id] })
    },
  })

  const publishPage = async (id: string, isPublished: boolean) => {
    loading.value = true
    error.value = null
    try {
      const result = (await publishPageMutation.mutateAsync({ id, isPublished })) as CmsPage
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
    }) => api.put('/cms/pages/reorder', { pageIds, parentId }),
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
        queryFn: () => api.get(`/cms/seo/${pageId}`, { query: { lang } }),
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
    }) => api.patch(`/cms/seo/${pageId}`, { ...seo, lang }),
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
      const result = await api.get<{ data: any[] }>('/translations', {
        query: {
          'filter[category]': category,
          'filter[lang]': lang,
          limit: 100,
        },
      })
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
      return await api.post('/translations', {
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
    return await api.post('/translations/dynamic/batch', {
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
      const result = await queryClient.fetchQuery({
        queryKey: ['cms', 'translations', entityName, query],
        queryFn: () =>
          api.get('/translations', {
            query: {
              'filter[entityName]': entityName,
              page: query.page,
              limit: query.limit,
              search: query.search,
            },
          }),
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
