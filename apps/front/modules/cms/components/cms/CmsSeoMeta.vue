<script setup lang="ts">
interface Props {
  seo: {
    metaTitle?: string | null;
    metaDescription?: string | null;
    ogImage?: string | null;
    customJsonLd?: Record<string, any> | null;
  };
  type?: "WebPage" | "Article" | "WebSite";
}

const props = withDefaults(defineProps<Props>(), {
  type: "WebPage",
});

const config = useRuntimeConfig();

const metaTitle = computed(() => props.seo?.metaTitle || "");
const metaDescription = computed(() => props.seo?.metaDescription || "");
const ogImage = computed(() => props.seo?.ogImage || "");
const jsonLd = computed(() => props.seo?.customJsonLd || null);

const localeOg = computed(() => {
  // Default to es_ES, can be made dynamic based on current lang
  return "es_ES";
});

useHead({
  title: metaTitle,
  meta: [
    {
      name: "description",
      content: metaDescription,
    },
    {
      property: "og:title",
      content: metaTitle,
    },
    {
      property: "og:description",
      content: metaDescription,
    },
    {
      property: "og:image",
      content: ogImage,
    },
    {
      property: "og:type",
      content: props.type === "Article" ? "article" : "website",
    },
    {
      property: "og:locale",
      content: localeOg,
    },
    {
      name: "twitter:card",
      content: "summary_large_image",
    },
    {
      name: "twitter:title",
      content: metaTitle,
    },
    {
      name: "twitter:description",
      content: metaDescription,
    },
    {
      name: "twitter:image",
      content: ogImage,
    },
  ],
  script: jsonLd.value
    ? [
        {
          type: "application/ld+json",
          children: () => JSON.stringify(jsonLd.value),
        },
      ]
    : [],
});
</script>

<template>
  <!-- Component is head-only - no visible render needed -->
</template>
