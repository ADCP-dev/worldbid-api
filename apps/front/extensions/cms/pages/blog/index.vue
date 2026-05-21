<script setup lang="ts">
import CmsSeoMeta from '@cms/components/cms/CmsSeoMeta.vue'
import SearchBox from '@cms/components/cms/SearchBox.vue'
import TagFilter from '@cms/components/cms/TagFilter.vue'
import Pagination from '@cms/components/cms/Pagination.vue'
import BlogPostCard from '@cms/components/cms/BlogPostCard.vue'
import Breadcrumbs from '@cms/components/cms/Breadcrumbs.vue'
import { useCmsBlogPosts } from '@cms/composables/useCmsBlogPosts'
import { useCmsTags } from '@cms/composables/useCmsTags'
import { useCmsCategories } from '@cms/composables/useCmsCategories'
import { useReadingTime } from '@cms/composables/useReadingTime'
import { useRouteQuery } from '@/composables/useRouteQuery'

definePageMeta({ layout: "public" })

const route = useRoute()
const { locale, t } = useI18n()
const { updateQuery } = useRouteQuery()
const localePath = useLocalePath()
const lang = locale
const config = useRuntimeConfig()

const page = computed(() => {
  const p = parseInt(route.query.page as string, 10)
  return isNaN(p) || p < 1 ? 1 : p
})
const limit = 9

const searchInput = ref((route.query.search as string) || '')

const selectedTags = computed({
  get: () => {
    const tags = route.query.tags
    return Array.isArray(tags) ? (tags as string[]) : tags ? [tags as string] : []
  },
  set: (value: string[]) => {
    updateQuery({ tags: value.length ? value : undefined }, ['tags'])
  },
})

const { fetchPostsPublic } = useCmsBlogPosts()
const { fetchTagsPublic, tags: allTags } = useCmsTags()
const { fetchCategories, categories: allCategories } = useCmsCategories()

// Auto-generate OG image for blog index
defineOgImage('OgImageBlogPost.satori', {
  title: 'Blog',
  description: locale.value === 'en' ? 'Articles and tutorials' : 'Artículos y tutoriales',
  siteName: config.public.appName || '',
  domain: (config.public.appUrl as string)?.replace(/^https?:\/\//, '') || '',
})

// Fetch SEO for blog index — awaited for SSR (REQ-2.1)
const { data: seoData } = await useAsyncData(
  'blog-index-seo',
  () => $fetch(`${config.public.apiUrl}${config.public.apiPrefix}/cms/seo/BlogIndex/blog-index?lang=${lang.value}`),
  { default: () => null },
)

// Fetch tags for filter
await fetchTagsPublic(lang.value)
await fetchCategories(lang.value)

function onSearch(value: string) {
  updateQuery({ search: value || undefined }, ['search'])
}

// Build query params from URL only — single source of truth
const queryParams = computed(() => ({
  lang: lang.value,
  page: page.value,
  limit,
  search: (route.query.search as string) || undefined,
  tags: selectedTags.value.length ? selectedTags.value : undefined,
}))

// Fetch posts
const { data: postsResponse, pending } = await useAsyncData(
  'blog-posts-public',
  () => fetchPostsPublic(queryParams.value),
  {
    watch: [queryParams],
  },
)

const postsList = computed(() => postsResponse.value?.data || [])
const meta = computed(() =>
  postsResponse.value?.meta || { page: 1, limit, total: 0, totalPages: 1 },
)

// Prepare SEO for CmsSeoMeta
const seo = computed(() => ({
  metaTitle: seoData.value?.metaTitle || 'Blog',
  metaDescription: seoData.value?.metaDescription || '',
  ogImage: seoData.value?.ogImage?.url || null,
  ogTitle: seoData.value?.ogTitle || seoData.value?.metaTitle || 'Blog',
  ogDescription: seoData.value?.ogDescription || seoData.value?.metaDescription || '',
  canonicalUrl: seoData.value?.canonicalUrl || `${config.public.appUrl}${localePath('/blog')}`,
  customJsonLd: seoData.value?.customJsonLd || null,
  robotsPolicy: seoData.value?.robotsPolicy || { index: true, follow: true },
  hreflangEnabled: seoData.value?.hreflangEnabled !== false,
  hreflangAlternateLocales: seoData.value?.hreflangAlternateLocales || null,
  hreflangCustomUrls: seoData.value?.hreflangCustomUrls || null,
}))

const tagItems = computed(() => {
  return (allTags.value || []).map((t) => ({
    id: t.id,
    name: t.name,
    count: undefined,
  }))
})
</script>

<template>
  <div class="container mx-auto py-12">
    <CmsSeoMeta :seo="seo" type="WebSite" :lang="lang" />

    <Breadcrumbs
      :items="[
        { name: 'Home', url: localePath('/') },
        { name: 'Blog' },
      ]"
    />

    <div class="mb-8">
      <h1 class="text-4xl font-bold mb-6">{{ t('cms.blog.title') }}</h1>

      <div class="flex flex-col md:flex-row gap-4 mb-6">
        <SearchBox
 v-model="searchInput" :placeholder="t('cms.blog.searchPlaceholder')" class="md:max-w-sm"
          @update:model-value="onSearch" />
        <div v-if="allCategories.length" class="flex flex-wrap items-center gap-2">
          <NuxtLink
            :to="localePath('/blog')"
            class="badge badge-outline badge-sm hover:badge-primary cursor-pointer"
            :class="{ 'badge-primary': !route.query.categoryId }"
          >
            {{ t('cms.blog.allCategories') }}
          </NuxtLink>
          <NuxtLink
            v-for="cat in allCategories"
            :key="cat.id"
            :to="localePath(`/blog/c/${cat.slug}`)"
            class="badge badge-outline badge-sm hover:badge-primary cursor-pointer"
          >
            {{ cat.name }}
          </NuxtLink>
        </div>
      </div>

      <TagFilter v-if="tagItems.length" v-model="selectedTags" :tags="tagItems" />
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
      <p class="text-lg text-base-content/70">{{ t('cms.blog.noResults') }}</p>
    </div>

    <!-- Pagination -->
    <div v-if="meta.totalPages > 1" class="flex justify-center mt-12">
      <Pagination :current-page="meta.page" :total-pages="meta.totalPages" />
    </div>
  </div>
</template>
