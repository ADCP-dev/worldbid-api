<script setup lang="ts">
definePageMeta({ layout: "public" })
import CmsSeoMeta from '@cms/components/cms/CmsSeoMeta.vue'
import Breadcrumbs from '@cms/components/cms/Breadcrumbs.vue'
import SearchBox from '@cms/components/cms/SearchBox.vue'
import TagFilter from '@cms/components/cms/TagFilter.vue'
import Pagination from '@cms/components/cms/Pagination.vue'
import { useCmsBlogPosts } from '@cms/composables/useCmsBlogPosts'
import { useCmsCategories } from '@cms/composables/useCmsCategories'
import { useCmsTags } from '@cms/composables/useCmsTags'

const route = useRoute()
const { locale } = useI18n()
const localePath = useLocalePath()
const lang = locale
const router = useRouter()
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
const { categories, fetchCategories } = useCmsCategories()
const { fetchTagsPublic, tags: allTags } = useCmsTags()

// Fetch categories to resolve slug → id
await fetchCategories(lang.value)

const category = computed(() => {
  const cats = categories.value || []
  return cats.find((c: any) => c.slug === categorySlug.value) || null
})

const categoryId = computed(() => category.value?.id)

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
  const query: Record<string, string | string[]> = {}
  for (const [key, val] of Object.entries(route.query)) {
    if (key !== 'search' && key !== 'page' && val !== undefined && val !== '') {
      query[key] = val as string | string[]
    }
  }
  if (value) query.search = value
  router.replace({ path: route.path, query })
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
  canonicalUrl: seoData.value?.canonicalUrl || `${config.public.apiUrl}${localePath('/blog/category/' + categorySlug.value)}`,
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
      <h1 class="text-4xl font-bold mb-2">{{ category?.name || 'Category' }}</h1>
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
      <article
        v-for="post in postsList"
        :key="post.id"
        class="card bg-base-100 shadow-xl overflow-hidden"
      >
        <figure v-if="post.featuredImage" class="relative">
          <img
            :src="post.featuredImage.url"
            :alt="post.translations?.title || post.slug"
            class="w-full h-48 object-cover"
          >
        </figure>
        <div class="card-body">
          <div v-if="post.categoryName || post.categoryId" class="mb-2">
            <NuxtLink
              :to="`/${lang}/blog/category/${post.category?.slug || post.categoryId}`"
              class="badge badge-primary badge-sm"
            >
              {{ post.categoryName || post.category?.name || 'Uncategorized' }}
            </NuxtLink>
          </div>

          <h2 class="card-title text-lg">
            <NuxtLink :to="`/${lang}/blog/${post.slug}`" class="hover:text-primary">
              {{ post.translations?.title || post.slug }}
            </NuxtLink>
          </h2>

          <p class="text-sm text-base-content/70">
            {{ post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : '' }}
          </p>

          <p v-if="post.translations?.excerpt" class="text-sm text-base-content/80 line-clamp-3">
            {{ post.translations.excerpt }}
          </p>

          <div v-if="post.tags?.length" class="flex flex-wrap gap-1 mt-3">
            <NuxtLink
              v-for="tag in post.tags"
              :key="tag.id"
              :to="`/${lang}/blog?tags=${tag.id}`"
              class="badge badge-outline badge-sm hover:badge-primary cursor-pointer"
            >
              {{ tag.name }}
            </NuxtLink>
          </div>

          <div class="card-actions justify-end mt-4">
            <NuxtLink :to="`/${lang}/blog/${post.slug}`" class="btn btn-primary btn-sm">
              Read more
            </NuxtLink>
          </div>
        </div>
      </article>
    </div>

    <!-- Empty -->
    <div v-else class="text-center py-12">
      <p class="text-lg text-base-content/70">No posts in this category.</p>
    </div>

    <div v-if="meta.totalPages > 1" class="flex justify-center mt-12">
      <Pagination
        :current-page="meta.page"
        :total-pages="meta.totalPages"
      />
    </div>
  </div>
</template>
