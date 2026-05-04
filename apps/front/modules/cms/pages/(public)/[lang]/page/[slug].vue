<script setup lang="ts">
import CmsSeoMeta from "@cms/components/cms/CmsSeoMeta.vue";

const route = useRoute();
const config = useRuntimeConfig();
const lang = computed(() => (route.params.lang as string) || "es");
const slug = computed(() => route.params.slug as string);

const { data: page, error } = await useFetch(
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
}));
</script>

<template>
  <div class="container mx-auto py-12 max-w-4xl">
    <CmsSeoMeta :seo="seoData" type="WebPage" />
    <article v-if="page">
      <h1 class="text-4xl font-bold mb-8">{{ title }}</h1>
      <div class="prose prose-lg max-w-none" v-html="content"/>
    </article>
  </div>
</template>