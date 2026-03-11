<script setup lang="ts">
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
const excerpt = computed(
  () => translations.value?.excerpt?.value || seo.value?.metaDescription || "",
);
const ogImage = computed(
  () => seo.value?.ogImage?.url || page.value?.featuredImage?.url || "",
);
const canonicalUrl = computed(
  () => seo.value?.canonicalUrl || `${config.public.appUrl}/${lang.value}/page/${slug.value}`,
);

const jsonLd = computed(() => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": title.value,
  "description": excerpt.value,
  "url": canonicalUrl.value,
  "image": ogImage.value,
  "inLanguage": lang.value,
  "publisher": {
    "@type": "Organization",
    "name": config.public.appName || "Foundation"
  }
}));

useHead({
  title: title.value,
  meta: [
    {
      name: "description",
      content: excerpt.value,
    },
    {
      name: "keywords",
      content: seo.value?.metaKeywords?.join(", "),
    },
    {
      property: "og:title",
      content: seo.value?.metaTitle || title.value,
    },
    {
      property: "og:description",
      content: excerpt.value,
    },
    {
      property: "og:image",
      content: ogImage.value,
    },
    {
      property: "og:url",
      content: canonicalUrl.value,
    },
    {
      property: "og:type",
      content: "website",
    },
    {
      property: "og:locale",
      content: lang.value === "es" ? "es_ES" : "en_US",
    },
    {
      name: "twitter:card",
      content: "summary_large_image",
    },
    {
      name: "twitter:title",
      content: seo.value?.metaTitle || title.value,
    },
    {
      name: "twitter:description",
      content: excerpt.value,
    },
    {
      name: "twitter:image",
      content: ogImage.value,
    },
  ],
  link: [
    { rel: "canonical", href: canonicalUrl.value },
  ],
  script: [
    {
      type: "application/ld+json",
      children: jsonLd,
    },
  ],
});
</script>

<template>
  <div class="container mx-auto py-12 max-w-4xl">
    <article v-if="page">
      <h1 class="text-4xl font-bold mb-8">{{ title }}</h1>
      <div class="prose prose-lg max-w-none" v-html="content"></div>
    </article>
  </div>
</template>