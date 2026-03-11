import { fetchWrapper } from "@/helpers/fetch-wrapper";

const runtimeConfig = useRuntimeConfig();
const baseUrl = `${runtimeConfig.public.apiUrl}${runtimeConfig.public.apiPrefix}`;

export interface CmsBlogPost {
  id: string;
  slug: string;
  author: string;
  categoryId: string | null;
  categoryName?: string;
  tags: string[];
  isPublished: boolean;
  publishedAt: string | null;
  featuredImage?: {
    id: string;
    url: string;
    name: string;
  };
}

export interface CmsBlogPostWithTranslations extends CmsBlogPost {
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

export function useCmsBlogPosts() {
  const posts = ref<CmsBlogPost[]>([]);
  const currentPost = ref<CmsBlogPostWithTranslations | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchPosts = async (
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

      const result = await fetchWrapper.get(
        `${baseUrl}/cms/blog/posts?${params}`,
      );
      posts.value = result.data || result;
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Error fetching posts";
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const fetchPost = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      currentPost.value = await fetchWrapper.get(
        `${baseUrl}/cms/blog/posts/${id}`,
      );
      return currentPost.value;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Error fetching post";
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const createPost = async (data: Partial<CmsBlogPost>) => {
    loading.value = true;
    error.value = null;
    try {
      const result = await fetchWrapper.post(`${baseUrl}/cms/blog/posts`, data);
      posts.value.unshift(result);
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Error creating post";
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const updatePost = async (id: string, data: Partial<CmsBlogPost>) => {
    loading.value = true;
    error.value = null;
    try {
      const result = await fetchWrapper.patch(
        `${baseUrl}/cms/blog/posts/${id}`,
        data,
      );
      const index = posts.value.findIndex((p) => p.id === id);
      if (index !== -1) posts.value[index] = result;
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Error updating post";
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const deletePost = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      await fetchWrapper.delete(`${baseUrl}/cms/blog/posts/${id}`);
      posts.value = posts.value.filter((p) => p.id !== id);
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Error deleting post";
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const publishPost = async (id: string, isPublished: boolean) => {
    loading.value = true;
    error.value = null;
    try {
      const result = await fetchWrapper.patch(
        `${baseUrl}/cms/blog/posts/${id}/publish`,
        { isPublished },
      );
      const index = posts.value.findIndex((p) => p.id === id);
      if (index !== -1) posts.value[index] = result;
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Error publishing post";
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const fetchPreview = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      const result = await fetchWrapper.get(
        `${baseUrl}/cms/blog/posts/${id}/preview`,
      );
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Error fetching preview";
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const fetchTranslations = async (entityId: string, lang: string = "es") => {
    try {
      return await fetchWrapper.get(
        `${baseUrl}/translations/dynamic/${lang}/BlogPost/${entityId}`,
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
        entityName: "BlogPost",
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
    seo: {
      metaTitle?: string;
      metaDescription?: string;
      metaKeywords?: string[];
      canonicalUrl?: string;
    },
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

  return {
    posts,
    currentPost,
    loading,
    error,
    fetchPosts,
    fetchPost,
    createPost,
    updatePost,
    deletePost,
    publishPost,
    fetchPreview,
    fetchTranslations,
    saveTranslation,
    fetchSeo,
    updateSeo,
  };
}
