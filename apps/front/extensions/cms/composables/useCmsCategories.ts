import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { fetchWrapper } from '@/helpers/fetch-wrapper'

export interface CmsCategory {
  id: string
  name: string
  description: string | null
  slug: string
  order?: number
  parentId?: string | null
  tags?: { id: string; name: string; slug: string }[]
}

export interface CmsCategoryTree extends CmsCategory {
  children: CmsCategoryTree[]
}

export function useCmsCategories() {
  const queryClient = useQueryClient()
  const runtimeConfig = useRuntimeConfig()
  const baseUrl = `${runtimeConfig.public.apiUrl}${runtimeConfig.public.apiPrefix}`
  const categories = ref<CmsCategory[]>([])
  const currentCategory = ref<CmsCategory | null>(null)
  const categoryTree = ref<CmsCategoryTree[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchCategories = async (lang = 'es') => {
    loading.value = true
    error.value = null
    try {
      const result = await queryClient.fetchQuery({
        queryKey: ['cms', 'blog', 'categories', lang],
        queryFn: () =>
          fetchWrapper.get(`${baseUrl}/cms/blog/categories/public?lang=${lang}`),
      })
      categories.value = result.data || result
      return result
    } catch (e) {
      error.value =
        e instanceof Error ? e.message : 'Error fetching categories'
      throw e
    } finally {
      loading.value = false
    }
  }

  const fetchCategory = async (id: string, lang = 'es') => {
    loading.value = true
    error.value = null
    try {
      currentCategory.value = await queryClient.fetchQuery({
        queryKey: ['cms', 'blog', 'categories', id, lang],
        queryFn: () =>
          fetchWrapper.get(`${baseUrl}/cms/blog/categories/${id}?lang=${lang}`),
      })
      return currentCategory.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error fetching category'
      throw e
    } finally {
      loading.value = false
    }
  }

  const createCategoryMutation = useMutation({
    mutationFn: (data: Partial<CmsCategory> & { tagIds?: string[]; lang?: string }) => {
      const { lang = 'es', ...body } = data
      return fetchWrapper.post(`${baseUrl}/cms/blog/categories?lang=${lang}`, body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'blog', 'categories'] })
    },
  })

  const createCategory = async (
    data: Partial<CmsCategory> & { tagIds?: string[]; lang?: string },
  ) => {
    loading.value = true
    error.value = null
    try {
      const result = await createCategoryMutation.mutateAsync(data)
      categories.value.unshift(result)
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error creating category'
      throw e
    } finally {
      loading.value = false
    }
  }

  const updateCategoryMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<CmsCategory> & { tagIds?: string[]; lang?: string }
    }) => {
      const { lang = 'es', ...body } = data
      return fetchWrapper.patch(
        `${baseUrl}/cms/blog/categories/${id}?lang=${lang}`,
        body,
      )
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'blog', 'categories'] })
      queryClient.invalidateQueries({
        queryKey: ['cms', 'blog', 'categories', variables.id],
      })
    },
  })

  const updateCategory = async (
    id: string,
    data: Partial<CmsCategory> & { tagIds?: string[]; lang?: string },
  ) => {
    loading.value = true
    error.value = null
    try {
      const result = await updateCategoryMutation.mutateAsync({ id, data })
      const index = categories.value.findIndex((c) => c.id === id)
      if (index !== -1) categories.value[index] = result
      if (currentCategory.value?.id === id) {
        currentCategory.value = result
      }
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error updating category'
      throw e
    } finally {
      loading.value = false
    }
  }

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) =>
      fetchWrapper.delete(`${baseUrl}/cms/blog/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'blog', 'categories'] })
    },
  })

  const deleteCategory = async (id: string) => {
    loading.value = true
    error.value = null
    try {
      await deleteCategoryMutation.mutateAsync(id)
      categories.value = categories.value.filter((c) => c.id !== id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error deleting category'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Build a hierarchical tree structure from flat categories
   */
  const buildCategoryTree = (
    cats: CmsCategory[],
    parentId: string | null = null,
  ): CmsCategoryTree[] => {
    return cats
      .filter((cat) => cat.parentId === parentId)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((cat) => ({
        ...cat,
        children: buildCategoryTree(cats, cat.id),
      }))
  }

  /**
   * Get categories as a hierarchical tree
   */
  const getCategoryTree = (): CmsCategoryTree[] => {
    categoryTree.value = buildCategoryTree(categories.value, null)
    return categoryTree.value
  }

  /**
   * Get all leaf categories (categories without children)
   */
  const getLeafCategories = (): CmsCategory[] => {
    return categories.value.filter((cat) => {
      return !categories.value.some((c) => c.parentId === cat.id)
    })
  }

  /**
   * Get category ancestors (path from root to category)
   */
  const getCategoryPath = (categoryId: string): CmsCategory[] => {
    const path: CmsCategory[] = []
    let current = categories.value.find((c) => c.id === categoryId)

    while (current) {
      path.unshift(current)
      current = current.parentId
        ? categories.value.find((c) => c.id === current!.parentId)
        : undefined
    }

    return path
  }

  /**
   * Get child categories (direct children only)
   */
  const getChildren = (parentId: string): CmsCategory[] => {
    return categories.value.filter((c) => c.parentId === parentId)
  }

  /**
   * Check if a category has children
   */
  const hasChildren = (categoryId: string): boolean => {
    return categories.value.some((c) => c.parentId === categoryId)
  }

  return {
    categories,
    currentCategory,
    categoryTree,
    loading,
    error,
    fetchCategories,
    fetchCategory,
    createCategory,
    updateCategory,
    deleteCategory,
    buildCategoryTree,
    getCategoryTree,
    getLeafCategories,
    getCategoryPath,
    getChildren,
    hasChildren,
  }
}
