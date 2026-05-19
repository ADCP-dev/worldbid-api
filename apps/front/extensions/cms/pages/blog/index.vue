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

definePageMeta({ layout: "public" })

const route = useRoute()
const { locale } = useI18n()
const localePath = useLocalePath()
const lang = locale
const router = useRouter()
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
    const query: Record<string, string | string[]> = {}
    for (const [key, val] of Object.entries(route.query)) {
      if (key !== 'tags' && key !== 'page' && val !== undefined && val !== '') {
        query[key] = val as string | string[]
      }
    }
    if (value.length) query.tags = value
    router.replace({ path: route.path, query })
  },
})

const { fetchPostsPublic } = useCmsBlogPosts()
const { fetchTagsPublic, tags: allTags } = useCmsTags()
const { fetchCategories, categories: allCategories } = useCmsCategories()

// Auto-generate OG image for blog index
defineOgImage('OgImageBlogPost', {
  title: 'Blog',
  description: 'Foundation Blog — Artículos y tutoriales',
  siteName: 'Foundation',
})

const selectedCategory = computed({
  get: () => (route.query.categoryId as string) || '',
  set: (value: string) => {
    const query: Record<string, string | string[]> = {}
    for (const [key, val] of Object.entries(route.query)) {
      if (key !== 'categoryId' && key !== 'page' && val !== undefined && val !== '') {
        query[key] = val as string | string[]
      }
    }
    if (value) query.categoryId = value
    router.replace({ path: route.path, query })
  },
})

// Fetch SEO for blog index
const { data: seoData } = useFetch(
  () => `${config.public.apiUrl}${config.public.apiPrefix}/cms/seo/BlogIndex/blog-index?lang=${lang.value}`,
  { server: true, default: () => null },
)

// Fetch tags for filter
await fetchTagsPublic(lang.value)
await fetchCategories(lang.value)

function onSearch(value: string) {
  const query: Record<string, string | string[]> = {}
  for (const [key, val] of Object.entries(route.query)) {
    if (key !== 'search' && key !== 'page' && val !== undefined && val !== '') {
      query[key] = val as string | string[]
    }
  }
  if (value) query.search = value
  router.replace({ path: route.path, query })
}

// Build query params from URL only — single source of truth
const queryParams = computed(() => ({
  lang: lang.value,
  page: page.value,
  limit,
  search: (route.query.search as string) || undefined,
  tags: selectedTags.value.length ? selectedTags.value : undefined,
  categoryId: (route.query.categoryId as string) || undefined,
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
  canonicalUrl: seoData.value?.canonicalUrl || `${config.public.apiUrl}${localePath('/blog')}`,
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
      <h1 class="text-4xl font-bold mb-6">Blog</h1>

      <div class="flex flex-col md:flex-row gap-4 mb-6">
        <SearchBox v-model="searchInput" placeholder="Search posts..." class="md:max-w-sm"
          @update:model-value="onSearch" />
        <select v-if="allCategories.length" :value="selectedCategory"
          class="select select-bordered select-sm w-full md:max-w-xs"
          @change="selectedCategory = ($event.target as HTMLSelectElement).value">
          <option value="">Todas las categorías</option>
          <option v-for="cat in allCategories" :key="cat.id" :value="cat.id">
            {{ cat.name }}
          </option>
        </select>
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
      <p class="text-lg text-base-content/70">No posts found.</p>
    </div>

    <!-- Pagination -->
    <div v-if="meta.totalPages > 1" class="flex justify-center mt-12">
      <Pagination :current-page="meta.page" :total-pages="meta.totalPages" />
    </div>
  </div>
</template>
