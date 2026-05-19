<script setup lang="ts">
import CmsSeoMeta from "@cms/components/cms/CmsSeoMeta.vue";
import ImageLightbox from "@cms/components/cms/ImageLightbox.vue";
import BlogPostCard from "@cms/components/cms/BlogPostCard.vue";
import Breadcrumbs from "@cms/components/cms/Breadcrumbs.vue";
import { useReadingTime } from "@cms/composables/useReadingTime";
import { useCmsBlogPosts } from "@cms/composables/useCmsBlogPosts";
definePageMeta({ layout: "public" })

const route = useRoute()
const { locale } = useI18n()
const localePath = useLocalePath()
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

// Related posts
const { data: related } = useFetch(
  `${apiBase.value}/cms/blog/posts/public/${encodeURIComponent(slug.value)}/related?limit=3`,
  { server: true, default: () => [] },
);

const title = computed(
  () => translations.value?.title?.value || post.value?.slug || "",
);
// SEO via composable (uses same pageId as admin)
const { fetchSeo } = useCmsBlogPosts();
const { data: seo } = useAsyncData(
  `blog-seo-${slug.value}-${lang.value}`,
  () => fetchSeo(post.value?.id, lang.value),
  { default: () => null },
);
const content = computed(
  () => translations.value?.content?.value || "",
);

// Prepare SEO data for CmsSeoMeta component
const seoData = computed(() => ({
  metaTitle: seo.value?.metaTitle || title.value,
  metaDescription: seo.value?.metaDescription || translations.value?.excerpt?.value || "",
  ogImage: seo.value?.ogImage?.url || post.value?.featuredImage?.url || null,
  ogTitle: seo.value?.ogTitle || seo.value?.metaTitle || title.value,
  ogDescription: seo.value?.ogDescription || seo.value?.metaDescription || translations.value?.excerpt?.value || "",
  canonicalUrl: seo.value?.canonicalUrl || `${config.public.apiUrl}${localePath('/blog/' + post.value?.slug)}`,
  customJsonLd: seo.value?.customJsonLd || null,
  robotsPolicy: seo.value?.robotsPolicy || { index: true, follow: true },
  hreflangEnabled: seo.value?.hreflangEnabled !== false,
  hreflangAlternateLocales: seo.value?.hreflangAlternateLocales || null,
  hreflangCustomUrls: seo.value?.hreflangCustomUrls || null,
}));

// Auto-generate OG image with nuxt-og-image
const featuredImageUrl = computed(() => {
  const img = post.value?.featuredImage;
  if (img?.url) return img.url;
  if (img?.path) return `${config.public.apiUrl}${img.path}`;
  return null;
});

defineOgImage('OgImageBlogPost.satori', {
  title: () => title.value,
  description: () => translations.value?.excerpt?.value || translations.value?.content?.value?.slice(0, 200) || '',
  image: () => featuredImageUrl.value,
  siteName: () => 'Foundation',
  category: () => post.value?.category?.name || '',
});

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

    <Breadcrumbs
      :items="[
        { name: 'Home', url: localePath('/') },
        { name: 'Blog', url: localePath('/blog') },
        { name: post?.category?.name || '' },
        { name: title },
      ].filter(b => b.name)"
    />

    <article v-if="post">
      <header class="mb-8">
        <h1 class="text-4xl font-bold mb-4">{{ title }}</h1>
        <div class="flex items-center gap-4 text-base-content/70 text-sm">
          <span v-if="post.publishedAt">
            {{ new Date(post.publishedAt).toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric' })
            }}
          </span>
          <span v-if="content">· {{ useReadingTime(content) }} min de lectura</span>
          <span v-if="post.author"> por {{ post.author }}</span>
        </div>
        <div v-if="post.tags?.length" class="flex gap-2 mt-3">
          <span v-for="tag in post.tags" :key="tag.id" class="badge badge-outline">
            {{ tag.name }}
          </span>
        </div>
      </header>

      <figure v-if="post.featuredImage" class="mb-8 -mx-4 sm:mx-0">
        <img :src="post.featuredImage.url || `${config.public.apiUrl}${post.featuredImage.path}`" :alt="title"
          class="w-full object-cover rounded-none sm:rounded-lg" style="max-height: 400px">
      </figure>

      <div class="prose prose-lg max-w-none blog-content" v-html="content" @click="onContentClick" />
    </article>

    <!-- Related Posts -->
    <section v-if="related?.length" class="mt-16 border-t pt-8">
      <h2 class="text-2xl font-bold mb-6">Artículos relacionados</h2>
      <div class="grid md:grid-cols-3 gap-6">
        <BlogPostCard v-for="r in related" :key="r.id" :post="r" :lang="lang" />
      </div>
    </section>
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
