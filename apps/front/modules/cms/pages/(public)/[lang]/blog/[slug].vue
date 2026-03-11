<script setup lang="ts">
const route = useRoute();
const config = useRuntimeConfig();
const lang = computed(() => (route.params.lang as string) || "es");
const slug = computed(() => route.params.slug as string);

const { data: post, error } = await useFetch(
  `/api/v1/cms/blog/posts/public/${slug.value}`,
  {
    query: { lang: lang.value },
  },
);

if (error.value) {
  throw createError({ statusCode: 404, statusMessage: "Post not found" });
}

const { data: translations } = await useFetch(
  `/api/v1/translations/dynamic/${lang.value}/BlogPost/${post.value?.id}`,
);

const { data: seo } = await useFetch(
  `/api/v1/cms/seo/${post.value?.id}?lang=${lang.value}`,
);

const title = computed(
  () => translations.value?.title?.value || post.value?.slug || "",
);
const content = computed(
  () => translations.value?.content?.value || "",
);
const excerpt = computed(
  () => translations.value?.excerpt?.value || seo.value?.metaDescription || "",
);
const ogImage = computed(
  () => seo.value?.ogImage?.url || post.value?.featuredImage?.url || "",
);
const canonicalUrl = computed(
  () => seo.value?.canonicalUrl || `${config.public.appUrl}/${lang.value}/blog/${slug.value}`,
);
const publishedAt = computed(() => post.value?.publishedAt ? new Date(post.value.publishedAt).toISOString() : null);

const jsonLd = computed(() => ({
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": title.value,
  "description": excerpt.value,
  "image": ogImage.value,
  "url": canonicalUrl.value,
  "datePublished": publishedAt.value,
  "inLanguage": lang.value,
  "author": {
    "@type": "Person",
    "name": post.value?.author || config.public.appName || "Foundation"
  },
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
      content: "article",
    },
    {
      property: "article:publishedTime",
      content: publishedAt.value,
    },
    {
      property: "article:author",
      content: post.value?.author || config.public.appName || "Foundation",
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

      <figure v-if="post.featuredImage" class="mb-8">
        <img
          :src="post.featuredImage.url"
          :alt="title"
          class="w-full rounded-lg"
        />
      </figure>

      <div class="prose prose-lg max-w-none" v-html="content"></div>
    </article>
  </div>
</template>