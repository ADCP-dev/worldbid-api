<script setup lang="ts">
import CmsSeoMeta from "@cms/components/cms/CmsSeoMeta.vue";

definePageMeta({
  layout: 'public',
});

const route = useRoute()
const { locale } = useI18n();
const config = useRuntimeConfig();
const lang = computed(() => locale.value);
const slug = computed(() => route.params.slug as string);

const { data: page, error, pending } = await useFetch(
  `/api/v1/cms/pages/public/${slug.value}`,
  {
    query: { lang: lang.value },
  },
);

if (error.value) {
  throw createError({ statusCode: 404, statusMessage: "Page not found" });
}

const { data: translations } = await useFetch(
  `/api/v1/translations/dynamic/${lang.value}/Page/${page.value?.id}`,
);

const { data: seo } = await useFetch(
  `/api/v1/cms/seo/${page.value?.id}?lang=${lang.value}`,
);

const title = computed(
  () => translations.value?.title?.value || page.value?.slug || "",
);
const content = computed(
  () => translations.value?.content?.value || "",
);

// Prepare SEO data for CmsSeoMeta component
const seoData = computed(() => ({
  metaTitle: seo.value?.metaTitle || title.value,
  metaDescription: seo.value?.metaDescription || translations.value?.excerpt?.value || "",
  ogImage: seo.value?.ogImage?.url || page.value?.featuredImage?.url || null,
  customJsonLd: seo.value?.customJsonLd || null,
}))

defineOgImage('OgImageBlogPost.satori', {
  title: title.value,
  description: translations.value?.excerpt?.value?.replace(/<[^>]*>/g, '') || '',
  siteName: config.public.appName || '',
  domain: (config.public.appUrl as string)?.replace(/^https?:\/\//, '') || '',
});
</script>

<template>
  <div class="container mx-auto py-12 max-w-4xl">
    <CmsSeoMeta :seo="seoData" type="WebPage" :lang="lang" />

    <!-- Skeleton loader while page data loads -->
    <div v-if="pending" class="space-y-4 p-8">
      <div class="skeleton h-10 w-3/4 mb-8"></div>
      <div class="skeleton h-4 w-full mb-2"></div>
      <div class="skeleton h-4 w-full mb-2"></div>
      <div class="skeleton h-4 w-11/12 mb-2"></div>
      <div class="skeleton h-4 w-full mb-2"></div>
      <div class="skeleton h-4 w-5/6 mb-2"></div>
      <div class="skeleton h-4 w-full mb-2"></div>
      <div class="skeleton h-4 w-3/4"></div>
    </div>

    <article v-else>
      <h1 class="text-4xl font-bold mb-8">{{ title }}</h1>
      <div class="prose prose-lg max-w-none" v-html="content"/>
    </article>
  </div>
</template>