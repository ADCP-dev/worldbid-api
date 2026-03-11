import { fetchWrapper } from "@/helpers/fetch-wrapper";

const runtimeConfig = useRuntimeConfig();
const baseUrl = `${runtimeConfig.public.apiUrl}${runtimeConfig.public.apiPrefix}`;

export interface CmsCategory {
  id: string;
  name: string;
  description: string | null;
  slug: string;
}

export function useCmsCategories() {
  const categories = ref<CmsCategory[]>([]);
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

  return {
    categories,
    loading,
    error,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
