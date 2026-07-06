import type { CmsTag } from '../types/cms';
import type { RobotsPolicy } from '../types/seo';

import { useMutation, useQueryClient } from '@tanstack/vue-query';

export type { CmsTag };

export interface CmsBlogPost {
  id: string;
  slug: string;
  author: string;
  categoryId: string | null;
  categoryName?: string;
  tagIds: string[];
  tags: CmsTag[];
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
    robotsPolicy?: RobotsPolicy;
    hreflangEnabled?: boolean;
    hreflangAlternateLocales?: string[] | null;
    hreflangCustomUrls?: Record<string, string> | null;
  };
}

export interface FetchPostsPublicParams {
  lang?: string;
  page?: number;
  limit?: number;
  search?: string;
  tags?: string[];
  categoryId?: string;
}

export function useCmsBlogPosts() {
  const queryClient = useQueryClient();
  const api = useApi();
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
      const result = await queryClient.fetchQuery({
        queryKey: ['cms', 'blog', 'posts', query],
        queryFn: () => api.get<{ data?: CmsBlogPost[] } | CmsBlogPost[]>('/cms/blog/posts', { query }),
      });
      posts.value = (result as { data?: CmsBlogPost[] }).data || (result as CmsBlogPost[]);
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error fetching posts';
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const fetchPostsPublic = async (query: FetchPostsPublicParams = {}) => {
    loading.value = true;
    error.value = null;
    try {
      const result = await queryClient.fetchQuery({
        queryKey: ['cms', 'blog', 'posts', 'public', query],
        queryFn: () => api.get<{ data?: CmsBlogPost[] } | CmsBlogPost[]>('/cms/blog/posts/public', { query }),
      });
      posts.value = (result as { data?: CmsBlogPost[] }).data || (result as CmsBlogPost[]);
      return result;
    } catch (e) {
      error.value =
        e instanceof Error ? e.message : 'Error fetching public posts';
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const fetchPost = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      currentPost.value = await queryClient.fetchQuery({
        queryKey: ['cms', 'blog', 'posts', id],
        queryFn: () => api.get<CmsBlogPostWithTranslations>(`/cms/blog/posts/${id}`),
      });
      return currentPost.value;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error fetching post';
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const createPostMutation = useMutation({
    mutationFn: (data: Partial<CmsBlogPost>) =>
      api.post<CmsBlogPost>('/cms/blog/posts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'blog', 'posts'] });
    },
  });

  const createPost = async (data: Partial<CmsBlogPost>) => {
    loading.value = true;
    error.value = null;
    try {
      const result = (await createPostMutation.mutateAsync(data)) as CmsBlogPost;
      posts.value.unshift(result);
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error creating post';
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const updatePostMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CmsBlogPost> }) =>
      api.patch<CmsBlogPost>(`/cms/blog/posts/${id}`, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'blog', 'posts'] });
      queryClient.invalidateQueries({
        queryKey: ['cms', 'blog', 'posts', variables.id],
      });
    },
  });

  const updatePost = async (id: string, data: Partial<CmsBlogPost>) => {
    loading.value = true;
    error.value = null;
    try {
      const result = (await updatePostMutation.mutateAsync({ id, data })) as CmsBlogPost;
      const index = posts.value.findIndex((p) => p.id === id);
      if (index !== -1) posts.value[index] = result;
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error updating post';
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const deletePostMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/cms/blog/posts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'blog', 'posts'] });
    },
  });

  const deletePost = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      await deletePostMutation.mutateAsync(id);
      posts.value = posts.value.filter((p) => p.id !== id);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error deleting post';
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const publishPostMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      api.patch<CmsBlogPost>(`/cms/blog/posts/${id}/publish`, { isPublished }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'blog', 'posts'] });
      queryClient.invalidateQueries({
        queryKey: ['cms', 'blog', 'posts', variables.id],
      });
    },
  });

  const publishPost = async (id: string, isPublished: boolean) => {
    loading.value = true;
    error.value = null;
    try {
      const result = (await publishPostMutation.mutateAsync({ id, isPublished })) as CmsBlogPost;
      const index = posts.value.findIndex((p) => p.id === id);
      if (index !== -1) posts.value[index] = result;
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error publishing post';
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const fetchPreview = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      const result = await queryClient.fetchQuery({
        queryKey: ['cms', 'blog', 'posts', id, 'preview'],
        queryFn: () => api.get(`/cms/blog/posts/${id}/preview`),
      });
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error fetching preview';
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const fetchTranslations = async (entityId: string, lang: string = 'es') => {
    try {
      return await api.get(
        `/translations/dynamic/${lang}/BlogPost/${entityId}`,
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
      return await api.post('/translations', {
        entityName: 'BlogPost',
        entityId,
        langCode: lang,
        key,
        content: value,
      });
    } catch (e) {
      throw e;
    }
  };

  const fetchSeo = async (pageId: string, lang: string = 'es') => {
    try {
      return await queryClient.fetchQuery({
        queryKey: ['cms', 'seo', pageId, lang],
        queryFn: () => api.get(`/cms/seo/${pageId}`, { query: { lang } }),
      });
    } catch (e) {
      return null;
    }
  };

  const fetchSeoForEntity = async (
    entityName: string,
    entityId: string,
    lang: string = 'es',
  ) => {
    try {
      return await queryClient.fetchQuery({
        queryKey: ['cms', 'seo', entityName, entityId, lang],
        queryFn: () =>
          api.get(`/cms/seo/${entityName}/${entityId}`, { query: { lang } }),
      });
    } catch (e) {
      return null;
    }
  };

  const updateSeoMutation = useMutation({
    mutationFn: ({
      pageId,
      seo,
      lang,
    }: {
      pageId: string;
      seo: {
        metaTitle?: string;
        metaDescription?: string;
        metaKeywords?: string[];
        canonicalUrl?: string;
      };
      lang: string;
    }) => api.patch(`/cms/seo/${pageId}`, { ...seo, lang }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['cms', 'seo', variables.pageId, variables.lang],
      });
    },
  });

  const updateSeo = async (
    pageId: string,
    seo: {
      metaTitle?: string;
      metaDescription?: string;
      metaKeywords?: string[];
      canonicalUrl?: string;
    },
    lang: string = 'es',
  ) => {
    loading.value = true;
    error.value = null;
    try {
      const result = await updateSeoMutation.mutateAsync({ pageId, seo, lang });
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error updating SEO';
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const fetchMediaByEntity = async (entityName: string, entityId: string) => {
    try {
      return await api.get('/cms/media', { query: { entityName, entityId } });
    } catch (e) {
      return null;
    }
  };

  interface BatchTranslationItem {
    section: string;
    key: string;
    value: string;
  }

  const saveTranslationsBatch = async (
    postId: string,
    lang: string,
    items: BatchTranslationItem[],
  ) => {
    return await api.post('/translations/dynamic/batch', {
      entityName: 'BlogPost',
      entityId: postId,
      lang,
      translations: items,
    });
  };

  const fetchPostsByCategory = async (
    categoryId: string,
    query: { page?: number; limit?: number; lang?: string } = {},
  ) => {
    loading.value = true;
    error.value = null;
    try {
      const result = await queryClient.fetchQuery({
        queryKey: ['cms', 'blog', 'posts', 'category', categoryId, query],
        queryFn: () =>
          api.get<{ data?: CmsBlogPost[] } | CmsBlogPost[]>(
            `/cms/blog/posts/public/category/${categoryId}`,
            { query },
          ),
      });
      posts.value = (result as { data?: CmsBlogPost[] }).data || (result as CmsBlogPost[]);
      return result;
    } catch (e) {
      error.value =
        e instanceof Error ? e.message : 'Error fetching posts by category';
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
    fetchPostsPublic,
    fetchPostsByCategory,
    fetchPost,
    createPost,
    updatePost,
    deletePost,
    publishPost,
    fetchPreview,
    fetchTranslations,
    saveTranslation,
    saveTranslationsBatch,
    fetchSeo,
    fetchSeoForEntity,
    updateSeo,
    fetchMediaByEntity,
  };
}
