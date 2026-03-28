import { fetchWrapper } from "@/helpers/fetch-wrapper";

const runtimeConfig = useRuntimeConfig();
const baseUrl = `${runtimeConfig.public.apiUrl}${runtimeConfig.public.apiPrefix}`;

export interface CmsCategory {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  order?: number;
  parentId?: string | null;
}

export interface CmsCategoryTree extends CmsCategory {
  children: CmsCategoryTree[];
}

export function useCmsCategories() {
  const categories = ref<CmsCategory[]>([]);
  const currentCategory = ref<CmsCategory | null>(null);
  const categoryTree = ref<CmsCategoryTree[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchCategories = async () => {
    loading.value = true;
    error.value = null;
    try {
      const result = await fetchWrapper.get(`${baseUrl}/cms/blog/categories`);
      categories.value = result.data || result;
      return result;
    } catch (e) {
      error.value =
        e instanceof Error ? e.message : "Error fetching categories";
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const fetchCategory = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      currentCategory.value = await fetchWrapper.get(
        `${baseUrl}/cms/blog/categories/${id}`,
      );
      return currentCategory.value;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Error fetching category";
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const createCategory = async (data: Partial<CmsCategory>) => {
    loading.value = true;
    error.value = null;
    try {
      const result = await fetchWrapper.post(
        `${baseUrl}/cms/blog/categories`,
        data,
      );
      categories.value.unshift(result);
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Error creating category";
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const updateCategory = async (id: string, data: Partial<CmsCategory>) => {
    loading.value = true;
    error.value = null;
    try {
      const result = await fetchWrapper.patch(
        `${baseUrl}/cms/blog/categories/${id}`,
        data,
      );
      const index = categories.value.findIndex((c) => c.id === id);
      if (index !== -1) categories.value[index] = result;
      if (currentCategory.value?.id === id) {
        currentCategory.value = result;
      }
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Error updating category";
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const deleteCategory = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      await fetchWrapper.delete(`${baseUrl}/cms/blog/categories/${id}`);
      categories.value = categories.value.filter((c) => c.id !== id);
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Error deleting category";
      throw e;
    } finally {
      loading.value = false;
    }
  };

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
      }));
  };

  /**
   * Get categories as a hierarchical tree
   */
  const getCategoryTree = (): CmsCategoryTree[] => {
    categoryTree.value = buildCategoryTree(categories.value, null);
    return categoryTree.value;
  };

  /**
   * Get all leaf categories (categories without children)
   */
  const getLeafCategories = (): CmsCategory[] => {
    return categories.value.filter((cat) => {
      return !categories.value.some((c) => c.parentId === cat.id);
    });
  };

  /**
   * Get category ancestors (path from root to category)
   */
  const getCategoryPath = (categoryId: string): CmsCategory[] => {
    const path: CmsCategory[] = [];
    let current = categories.value.find((c) => c.id === categoryId);

    while (current) {
      path.unshift(current);
      current = current.parentId
        ? categories.value.find((c) => c.id === current!.parentId)
        : undefined;
    }

    return path;
  };

  /**
   * Get child categories (direct children only)
   */
  const getChildren = (parentId: string): CmsCategory[] => {
    return categories.value.filter((c) => c.parentId === parentId);
  };

  /**
   * Check if a category has children
   */
  const hasChildren = (categoryId: string): boolean => {
    return categories.value.some((c) => c.parentId === categoryId);
  };

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
  };
}
