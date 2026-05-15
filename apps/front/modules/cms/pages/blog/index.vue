<script setup lang="ts">
definePageMeta({ layout: "public" })
import CmsSeoMeta from '@cms/components/cms/CmsSeoMeta.vue'
import SearchBox from '@cms/components/cms/SearchBox.vue'
import TagFilter from '@cms/components/cms/TagFilter.vue'
import Pagination from '@cms/components/cms/Pagination.vue'
import { useCmsBlogPosts } from '@cms/composables/useCmsBlogPosts'
import { useCmsTags } from '@cms/composables/useCmsTags'
import { useReadingTime } from '@cms/composables/useReadingTime'

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

// Fetch SEO for blog index
const { data: seoData } = useFetch(
  () => `${config.public.apiUrl}${config.public.apiPrefix}/cms/seo/BlogIndex/blog-index?lang=${lang.value}`,
  { server: true, default: () => null },
)

// Fetch tags for filter
await fetchTagsPublic(lang.value)

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
  canonicalUrl: seoData.value?.canonicalUrl || `${config.public.apiUrl}/${lang.value}/blog`,
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

    <div class="mb-8">
      <h1 class="text-4xl font-bold mb-6">Blog</h1>

      <div class="flex flex-col md:flex-row gap-4 mb-6">
        <SearchBox
          v-model="searchInput"
          placeholder="Search posts..."
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
      <article
        v-for="post in postsList"
        :key="post.id"
        class="card bg-base-100 shadow-xl overflow-hidden"
      >
        <figure v-if="post.featuredImage" class="relative">
          <img
            :src="post.featuredImage.url || `${config.public.apiUrl}${post.featuredImage.path}`"
            :alt="post.translations?.title || post.slug"
            class="w-full h-48 object-cover"
          >
        </figure>
        <div class="card-body">
          <div v-if="post.categoryName || post.categoryId" class="mb-2">
            <NuxtLink
              :to="localePath(`/blog/category/${post.category?.slug || post.categoryId}`)"
              class="badge badge-primary badge-sm hover:badge-primary"
            >
              {{ post.categoryName || post.category?.name || 'Uncategorized' }}
            </NuxtLink>
          </div>

          <h2 class="card-title text-lg">
            <NuxtLink :to="localePath(`/blog/${post.slug}`)" class="hover:text-primary">
              {{ post.translations?.title || post.slug }}
            </NuxtLink>
          </h2>

          <p class="text-sm text-base-content/70 flex items-center gap-3">
            <span v-if="post.publishedAt">
              {{ new Date(post.publishedAt).toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric' }) }}
            </span>
            <span v-if="post.translations?.content" class="text-base-content/50">
              · {{ useReadingTime(post.translations.content) }} min de lectura
            </span>
          </p>

          <p v-if="post.translations?.excerpt" class="text-sm text-base-content/80 line-clamp-3">
            {{ post.translations.excerpt }}
          </p>
          <p v-else-if="post.translations?.content" class="text-sm text-base-content/80 line-clamp-2" v-html="post.translations.content.replace(/<[^>]+>/g, '').slice(0, 200) + '...'" />

          <div v-if="post.tags?.length" class="flex flex-wrap gap-1 mt-3">
            <NuxtLink
              v-for="tag in post.tags"
              :key="tag.id"
              :to="localePath(`/blog?tags=${tag.id}`)"
              class="badge badge-outline badge-sm hover:badge-primary cursor-pointer"
            >
              {{ tag.name }}
            </NuxtLink>
          </div>

          <div class="card-actions justify-end mt-4">
            <NuxtLink :to="localePath(`/blog/${post.slug}`)" class="btn btn-primary btn-sm">
              Read more
            </NuxtLink>
          </div>
        </div>
      </article>
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-12">
      <p class="text-lg text-base-content/70">No posts found.</p>
    </div>

    <!-- Pagination -->
    <div v-if="meta.totalPages > 1" class="flex justify-center mt-12">
      <Pagination
        :current-page="meta.page"
        :total-pages="meta.totalPages"
      />
    </div>
  </div>
</template>
