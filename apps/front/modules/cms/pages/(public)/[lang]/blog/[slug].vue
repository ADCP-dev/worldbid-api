<script setup lang="ts">
import CmsSeoMeta from "@cms/components/cms/CmsSeoMeta.vue";

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

// Prepare SEO data for CmsSeoMeta component
const seoData = computed(() => ({
  metaTitle: seo.value?.metaTitle || title.value,
  metaDescription: seo.value?.metaDescription || translations.value?.excerpt?.value || "",
  ogImage: seo.value?.ogImage?.url || post.value?.featuredImage?.url || null,
  customJsonLd: seo.value?.customJsonLd || null,
}));
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

      <figure v-if="post.featuredImage" class="mb-8">
        <img
          :src="post.featuredImage.url"
          :alt="title"
          class="w-full rounded-lg"
        >
      </figure>

      <div class="prose prose-lg max-w-none" v-html="content"/>
    </article>
  </div>
</template>