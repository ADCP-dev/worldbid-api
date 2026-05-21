<script setup lang="ts">
import type { BlogPost } from '@cms/types/blog'
import { useReadingTime } from '@cms/composables/useReadingTime'

const props = defineProps<{
  post: BlogPost
  lang: string
}>()

const config = useRuntimeConfig()
const localePath = useLocalePath()
const { t } = useI18n()

function getTitle(post: BlogPost, lang: string): string {
  return post.translations?.[lang]?.title || post.slug || ''
}

function getExcerpt(post: BlogPost, lang: string): string {
  if (post.translations?.[lang]?.excerpt) return post.translations[lang].excerpt
  const content = post.translations?.[lang]?.content
  if (content) {
    const text = content.replace(/<[^>]+>/g, '').trim()
    return text.length > 150 ? text.slice(0, 150) + '...' : text
  }
  return ''
}

function getImageUrl(post: BlogPost): string {
  if (post.featuredImage?.url) return post.featuredImage.url
  if (post.featuredImage?.path) return `${config.public.apiUrl}${post.featuredImage.path}`
  return ''
}

const readingTime = computed(() => {
  const content = props.post.translations?.[props.lang]?.content
  if (!content) return 0
  return useReadingTime(content)
})
</script>

<template>
  <article class="card bg-base-100 shadow-xl overflow-hidden">
    <figure v-if="post.featuredImage" class="relative">
      <img
        :src="getImageUrl(post)"
        :alt="getTitle(post, lang)"
        class="w-full h-48 object-cover"
      >
    </figure>
    <div class="card-body">
      <div v-if="post.category" class="mb-2">
        <NuxtLink
          :to="localePath(`/blog/c/${post.category.slug}`)"
          class="badge badge-primary badge-sm hover:badge-primary"
        >
          {{ post.category.name }}
        </NuxtLink>
      </div>

      <h2 class="card-title text-lg">
        <NuxtLink :to="localePath(`/blog/${post.slug}`)" class="hover:text-primary">
          {{ getTitle(post, lang) }}
        </NuxtLink>
      </h2>

      <p class="text-sm text-base-content/70 flex items-center gap-3">
        <span v-if="post.publishedAt">
          {{ new Date(post.publishedAt).toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric' }) }}
        </span>
        <span v-if="readingTime > 0" class="text-base-content/50">
          · {{ readingTime }} {{ t('cms.blog.readingTime') }}
        </span>
      </p>

      <p v-if="getExcerpt(post, lang)" class="text-sm text-base-content/80 line-clamp-2">
        {{ getExcerpt(post, lang) }}
      </p>

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
          {{ t('cms.blog.readMore') }}
        </NuxtLink>
      </div>
    </div>
  </article>
</template>
