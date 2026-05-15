<script setup lang="ts">
definePageMeta({ layout: "public" })
import CmsSeoMeta from "@cms/components/cms/CmsSeoMeta.vue";
import ImageLightbox from "@cms/components/cms/ImageLightbox.vue";

const route = useRoute()
const { locale } = useI18n()
const lang = locale
const config = useRuntimeConfig();
const slug = computed(() => route.params.slug as string);

const apiBase = computed(() => `${config.public.apiUrl}${config.public.apiPrefix}`);

const apiSlug = computed(() => slug.value);

const { data: post, error, pending } = await useFetch(
  `${apiBase.value}/cms/blog/posts/public/${apiSlug.value}`,
  {
    query: { lang: lang.value },
  },
);

if (error.value && !pending.value) {
  throw createError({ statusCode: 404, statusMessage: "Post not found" });
}

// Dynamic translations — non-blocking
const { data: translations } = useFetch(
  `${apiBase.value}/translations/dynamic/${lang.value}/BlogPost/${post.value?.id}`,
  { server: true, default: () => null },
);

// SEO — non-blocking
const { data: seo } = useFetch(
  `${apiBase.value}/cms/seo/BlogPost/${post.value?.id}?lang=${lang.value}`,
  { server: true, default: () => null },
);

const title = computed(
  () => translations.value?.title?.value || post.value?.slug || "",
);
const content = computed(
  () => translations.value?.content?.value || "",
);

// Prepare SEO data for CmsSeoMeta component
const seoData = computed(() => ({
  metaTitle: seo.value?.metaTitle || title.value,
  metaDescription: seo.value?.metaDescription || translations.value?.excerpt?.value || "",
  ogImage: seo.value?.ogImage?.url || post.value?.featuredImage?.url || null,
  customJsonLd: seo.value?.customJsonLd || null,
}));

// Lightbox
const lightboxSrc = ref("");
const lightboxAlt = ref("");
const showLightbox = ref(false);

function onContentClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target.tagName === "IMG") {
    lightboxSrc.value = target.getAttribute("src") || "";
    lightboxAlt.value = target.getAttribute("alt") || "";
    showLightbox.value = true;
  }
}
</script>

<template>
  <div class="container mx-auto py-12 max-w-4xl">
    <CmsSeoMeta :seo="seoData" type="Article" />
    <article v-if="post">
      <header class="mb-8">
        <h1 class="text-4xl font-bold mb-4">{{ title }}</h1>
        <div class="flex items-center gap-4 text-muted">
          <span v-if="post.publishedAt">
            {{ new Date(post.publishedAt).toLocaleDateString() }}
          </span>
          <span v-if="post.author"> por {{ post.author }}</span>
        </div>
        <div v-if="post.tags?.length" class="flex gap-2 mt-2">
          <span v-for="tag in post.tags" :key="tag" class="badge badge-outline">
            {{ tag }}
          </span>
        </div>
      </header>

      <figure v-if="post.featuredImage" class="mb-8 -mx-4 sm:mx-0">
        <img
          :src="post.featuredImage.url || `${config.public.apiUrl}${post.featuredImage.path}`"
          :alt="title"
          class="w-full object-cover rounded-none sm:rounded-lg"
          style="max-height: 400px"
        >
      </figure>

      <div class="prose prose-lg max-w-none blog-content" v-html="content" @click="onContentClick"/>
    </article>
  </div>

  <ImageLightbox :src="lightboxSrc" :alt="lightboxAlt" :visible="showLightbox" @close="showLightbox = false" />
</template>

<style>
.blog-content img {
  border-radius: 0.5rem;
  max-width: min(100%, 28rem);
  height: auto;
  display: block;
  margin-left: auto;
  margin-right: auto;
}
</style>