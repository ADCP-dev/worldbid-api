<script setup lang="ts">
import CmsSeoMeta from '@cms/components/cms/CmsSeoMeta.vue'
import Breadcrumbs from '@cms/components/cms/Breadcrumbs.vue'
import SearchBox from '@cms/components/cms/SearchBox.vue'
import TagFilter from '@cms/components/cms/TagFilter.vue'
import Pagination from '@cms/components/cms/Pagination.vue'
import BlogPostCard from '@cms/components/cms/BlogPostCard.vue'
import { useCmsBlogPosts } from '@cms/composables/useCmsBlogPosts'
import { useCmsCategories } from '@cms/composables/useCmsCategories'
import { useCmsTags } from '@cms/composables/useCmsTags'
import { useRouteQuery } from '@/composables/useRouteQuery'
definePageMeta({ layout: "public" })

const route = useRoute()
const { locale, t } = useI18n()
const localePath = useLocalePath()
const lang = locale
const { updateQuery } = useRouteQuery()
const config = useRuntimeConfig()

const categorySlug = computed(() => route.params.slug as string)

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
const { categories, fetchCategories } = useCmsCategories()
const { fetchTagsPublic, tags: allTags } = useCmsTags()

// Fetch categories to resolve slug → id
await fetchCategories(lang.value)

const category = computed(() => {
  const cats = categories.value || []
  return cats.find((c: any) => c.slug === categorySlug.value) || null
})

const categoryId = computed(() => category.value?.id)

defineOgImage('OgImageBlogPost.satori', {
  title: category.value?.name || categorySlug.value,
  description: category.value?.description || '',
  siteName: config.public.appName || '',
  domain: (config.public.appUrl as string)?.replace(/^https?:\/\//, '') || '',
  category: category.value?.name || '',
})

// Fetch tags
await fetchTagsPublic(lang.value)

// Fetch SEO for category
const { data: seoData } = useFetch(
  () => categoryId.value
    ? `${config.public.apiUrl}${config.public.apiPrefix}/cms/seo/BlogCategory/${categoryId.value}?lang=${lang.value}`
    : undefined,
  { server: true, default: () => null },
)

function onSearch(value: string) {
  updateQuery({ search: value || undefined }, ['search'])
}

const queryParams = computed(() => ({
  lang: lang.value,
  page: page.value,
  limit,
  categoryId: categoryId.value,
  search: (route.query.search as string) || undefined,
  tags: selectedTags.value.length ? selectedTags.value : undefined,
}))

const { data: postsResponse, pending } = await useAsyncData(
  () => `blog-category-${categorySlug.value}`,
  () => fetchPostsPublic(queryParams.value),
  { watch: [queryParams] },
)

const postsList = computed(() => postsResponse.value?.data || [])
const meta = computed(() =>
  postsResponse.value?.meta || { page: 1, limit, total: 0, totalPages: 1 },
)

const seo = computed(() => ({
  metaTitle: seoData.value?.metaTitle || category.value?.name || 'Category',
  metaDescription: seoData.value?.metaDescription || category.value?.description || '',
  ogImage: seoData.value?.ogImage?.url || null,
  ogTitle: seoData.value?.ogTitle || seoData.value?.metaTitle || category.value?.name || 'Category',
  ogDescription: seoData.value?.ogDescription || seoData.value?.metaDescription || category.value?.description || '',
  canonicalUrl: seoData.value?.canonicalUrl || `${config.public.appUrl}${localePath('/blog/category/' + categorySlug.value)}`,
  customJsonLd: seoData.value?.customJsonLd || null,
  robotsPolicy: seoData.value?.robotsPolicy || { index: true, follow: true },
  hreflangEnabled: seoData.value?.hreflangEnabled !== false,
  hreflangAlternateLocales: seoData.value?.hreflangAlternateLocales || null,
  hreflangCustomUrls: seoData.value?.hreflangCustomUrls || null,
}))

const tagItems = computed(() => {
  return (allTags.value || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    count: undefined,
  }))
})
</script>

<template>
  <div class="container mx-auto py-12">
    <CmsSeoMeta :seo="seo" type="WebPage" :lang="lang" />

    <Breadcrumbs
      :items="[
        { name: 'Home', url: localePath('/') },
        { name: 'Blog', url: localePath('/blog') },
        { name: category?.name || categorySlug },
      ]"
    />

    <div class="mb-8">
      <h1 class="text-4xl font-bold mb-2">{{ category?.name || t('ext.cms.blog.title') }}</h1>
      <p v-if="category?.description" class="text-base-content/70">{{ category.description }}</p>

      <div class="flex flex-col md:flex-row gap-4 mb-6 mt-6">
        <SearchBox
          v-model="searchInput"
          placeholder="Search in category..."
          class="md:max-w-sm"
          @update:model-value="onSearch"
        />
      </div>

      <TagFilter
        v-if="tagItems.length"
        v-model="selectedTags"
        :tags="tagItems"
      />
    </div>

    <!-- Loading -->
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

    <!-- Posts -->
    <div v-else-if="postsList.length" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      <BlogPostCard v-for="post in postsList" :key="post.id" :post="post" :lang="lang" />
    </div>

    <!-- Empty -->
    <div v-else class="text-center py-12">
      <p class="text-lg text-base-content/70">{{ t('ext.cms.blog.noResults') }}</p>
    </div>

    <div v-if="meta.totalPages > 1" class="flex justify-center mt-12">
      <Pagination
        :current-page="meta.page"
        :total-pages="meta.totalPages"
      />
    </div>
  </div>
</template>
