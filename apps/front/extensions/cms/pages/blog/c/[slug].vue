<script setup lang="ts">
import CmsSeoMeta from '@cms/components/cms/CmsSeoMeta.vue'
import Breadcrumbs from '@cms/components/cms/Breadcrumbs.vue'
import BlogPostCard from '@cms/components/cms/BlogPostCard.vue'
import { useCmsBlogPosts } from '@cms/composables/useCmsBlogPosts'
definePageMeta({ layout: "public" })

const route = useRoute()
const { locale, t } = useI18n()
const localePath = useLocalePath()
const lang = locale
const config = useRuntimeConfig()

const slug = computed(() => route.params.slug as string)

const apiBase = computed(() => `${config.public.apiUrl}${config.public.apiPrefix}`)

// Fetch category directly by slug (NEW endpoint)
const { data: category, error: catError, pending: catPending } = await useFetch(
  () => `${apiBase.value}/cms/blog/categories/public/by-slug/${slug.value}`,
  { server: true },
)

// 404 if category not found
if (catError.value && !catPending.value) {
  throw createError({ statusCode: 404, statusMessage: 'Category not found' })
}

const categoryId = computed(() => category.value?.id)

// Fetch SEO for category
const { data: seoData } = useFetch(
  () => categoryId.value
    ? `${apiBase.value}/cms/seo/BlogCategory/${categoryId.value}?lang=${lang.value}`
    : undefined,
  { server: true, default: () => null },
)

const seo = computed(() => ({
  metaTitle: seoData.value?.metaTitle || category.value?.name || 'Category',
  metaDescription: seoData.value?.metaDescription || category.value?.description || '',
  ogImage: seoData.value?.ogImage?.url || null,
  ogTitle: seoData.value?.ogTitle || seoData.value?.metaTitle || category.value?.name || 'Category',
  ogDescription: seoData.value?.ogDescription || seoData.value?.metaDescription || category.value?.description || '',
  canonicalUrl: seoData.value?.canonicalUrl || `${config.public.appUrl}${localePath('/blog/c/' + slug.value)}`,
  customJsonLd: seoData.value?.customJsonLd || null,
  robotsPolicy: seoData.value?.robotsPolicy || { index: true, follow: true },
  hreflangEnabled: seoData.value?.hreflangEnabled !== false,
  hreflangAlternateLocales: seoData.value?.hreflangAlternateLocales || null,
  hreflangCustomUrls: seoData.value?.hreflangCustomUrls || null,
}))

// OG Image
defineOgImage('OgImageBlogPost.satori', {
  title: category.value?.name || slug.value,
  description: category.value?.description || '',
  siteName: config.public.appName || '',
  domain: (config.public.appUrl as string)?.replace(/^https?:\/\//, '') || '',
  category: category.value?.name || '',
})

// Fetch posts for category
const { fetchPostsPublic } = useCmsBlogPosts()

const queryParams = computed(() => ({
  lang: lang.value,
  page: 1,
  limit: 9,
  categoryId: categoryId.value,
}))

const { data: postsResponse, pending: postsPending } = await useAsyncData(
  () => `blog-c-${slug.value}`,
  () => categoryId.value ? fetchPostsPublic(queryParams.value) : Promise.resolve({ data: [], meta: { total: 0 } }),
  { watch: [queryParams] },
)

const postsList = computed(() => postsResponse.value?.data || [])

const pending = computed(() => catPending.value || postsPending.value)
</script>

<template>
  <div class="container mx-auto py-12">
    <CmsSeoMeta :seo="seo" type="WebPage" :lang="lang" />

    <Breadcrumbs
      :items="[
        { name: 'Home', url: localePath('/') },
        { name: 'Blog', url: localePath('/blog') },
        { name: category?.name || slug },
      ]"
    />

    <div class="mb-8">
      <h1 class="text-4xl font-bold mb-2">{{ category?.name || t('ext.cms.blog.title') }}</h1>
      <p v-if="category?.description" class="text-base-content/70">{{ category.description }}</p>
    </div>

    <!-- Loading skeleton -->
    <div v-if="pending" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="i in 6" :key="i" class="card bg-base-100 shadow-xl">
        <div class="skeleton h-48 w-full" />
        <div class="card-body">
          <div class="skeleton h-6 w-3/4 mb-2" />
          <div class="skeleton h-4 w-1/2 mb-2" />
          <div class="skeleton h-4 w-full mb-1" />
          <div class="skeleton h-4 w-2/3" />
        </div>
      </div>
    </div>

    <!-- Posts grid -->
    <div v-else-if="postsList.length" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      <BlogPostCard v-for="post in postsList" :key="post.id" :post="post" :lang="lang" />
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-12">
      <p class="text-lg text-base-content/70">{{ t('ext.cms.blog.noResults') }}</p>
    </div>
  </div>
</template>
