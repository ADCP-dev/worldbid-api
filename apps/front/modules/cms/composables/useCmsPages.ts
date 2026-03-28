import { fetchWrapper } from "@/helpers/fetch-wrapper";

const runtimeConfig = useRuntimeConfig();
const baseUrl = `${runtimeConfig.public.apiUrl}${runtimeConfig.public.apiPrefix}`;

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  route: string;
  template: string;
  order: number;
  isPublished: boolean;
  publishedAt: string | null;
  featuredImage?: {
    id: string;
    url: string;
    name: string;
  };
}

export interface CmsPageWithTranslations extends CmsPage {
  translations: {
    title: string;
    content: string;
    excerpt: string;
  };
  seo: {
    metaTitle: string;
    metaDescription: string;
    metaKeywords: string[];
    ogImage?: { url: string };
  };
}

export interface CmsSeoMetadata {
  id?: string;
  pageId: string;
  lang: string;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string[];
  ogImage?: {
    id: string;
    url: string;
    name: string;
  };
  canonicalUrl?: string;
}

export function useCmsPages() {
  const pages = ref<CmsPage[]>([]);
  const currentPage = ref<CmsPageWithTranslations | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchPages = async (
    query: { page?: number; limit?: number; published?: boolean } = {},
  ) => {
    loading.value = true;
    error.value = null;
    try {
      const params = new URLSearchParams();
      if (query.page) params.append("page", String(query.page));
      if (query.limit) params.append("limit", String(query.limit));
      if (query.published !== undefined)
        params.append("published", String(query.published));

      const result = await fetchWrapper.get(`${baseUrl}/cms/pages?${params}`);
      pages.value = result.data;
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Error fetching pages";
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const fetchPage = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      currentPage.value = await fetchWrapper.get(`${baseUrl}/cms/pages/${id}`);
      return currentPage.value;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Error fetching page";
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const createPage = async (data: Partial<CmsPage>) => {
    loading.value = true;
    error.value = null;
    try {
      const result = await fetchWrapper.post(`${baseUrl}/cms/pages`, data);
      pages.value.unshift(result);
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Error creating page";
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const updatePage = async (id: string, data: Partial<CmsPage>) => {
    loading.value = true;
    error.value = null;
    try {
      const result = await fetchWrapper.patch(
        `${baseUrl}/cms/pages/${id}`,
        data,
      );
      const index = pages.value.findIndex((p) => p.id === id);
      if (index !== -1) pages.value[index] = result;
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Error updating page";
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const deletePage = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      await fetchWrapper.delete(`${baseUrl}/cms/pages/${id}`);
      pages.value = pages.value.filter((p) => p.id !== id);
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Error deleting page";
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const publishPage = async (id: string, isPublished: boolean) => {
    loading.value = true;
    error.value = null;
    try {
      const result = await fetchWrapper.patch(
        `${baseUrl}/cms/pages/${id}/publish`,
        { isPublished },
      );
      const index = pages.value.findIndex((p) => p.id === id);
      if (index !== -1) pages.value[index] = result;
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Error publishing page";
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const fetchSeo = async (pageId: string, lang: string = "es") => {
    try {
      return await fetchWrapper.get(
        `${baseUrl}/cms/seo/${pageId}?lang=${lang}`,
      );
    } catch (e) {
      return null;
    }
  };

  const updateSeo = async (
    pageId: string,
    seo: Partial<CmsSeoMetadata>,
    lang: string = "es",
  ) => {
    loading.value = true;
    error.value = null;
    try {
      const result = await fetchWrapper.patch(
        `${baseUrl}/cms/seo/${pageId}?lang=${lang}`,
        seo,
      );
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Error updating SEO";
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const fetchTranslations = async (entityId: string, lang: string = "es") => {
    try {
      return await fetchWrapper.get(
        `${baseUrl}/translations/dynamic/${lang}/Page/${entityId}`,
      );
    } catch (e) {
      return null;
    }
  };

  const saveTranslation = async (
    entityId: string,
    lang: string,
    key: string,
    value: string,
  ) => {
    try {
      return await fetchWrapper.post(`${baseUrl}/translations`, {
        entityName: "Page",
        entityId,
        langCode: lang,
        key,
        content: value,
      });
    } catch (e) {
      console.error("Error saving translation:", e);
      throw e;
    }
  };

  const saveAllTranslations = async (
    entityId: string,
    lang: string,
    data: { title: string; content: string; excerpt: string },
  ) => {
    await Promise.all([
      saveTranslation(entityId, lang, "title", data.title),
      saveTranslation(entityId, lang, "content", data.content),
      saveTranslation(entityId, lang, "excerpt", data.excerpt),
    ]);
  };

  const reorderPages = async (pageIds: string[], parentId: string | null) => {
    loading.value = true;
    error.value = null;
    try {
      await fetchWrapper.put(`${baseUrl}/cms/pages/reorder`, {
        pageIds,
        parentId,
      });
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Error reordering pages";
      throw e;
    } finally {
      loading.value = false;
    }
  };

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
    saveAllTranslations,
    reorderPages,
  };
}
