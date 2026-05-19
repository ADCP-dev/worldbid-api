<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: "auth",
});

const { t, locale, locales } = useI18n();
const route = useRoute();
const { fetchPreview, fetchTranslations, fetchSeo, loading } =
  useCmsBlogPosts();

const postId = route.params.id as string;
const currentLang = ref(locale.value || "es");

const post = ref<any>(null);
const translations = ref<any>(null);
const seo = ref<any>(null);

onMounted(async () => {
  try {
    post.value = await fetchPreview(postId);
    translations.value = await fetchTranslations(postId, currentLang.value);
    seo.value = await fetchSeo(postId, currentLang.value);
  } catch (e) {
    console.error("Error loading preview:", e);
  }
});

const handleLanguageChange = async () => {
  try {
    translations.value = await fetchTranslations(postId, currentLang.value);
    seo.value = await fetchSeo(postId, currentLang.value);
  } catch (e) {
    console.error("Error loading translations:", e);
  }
};

const title = computed(
  () => translations.value?.title?.value || post.value?.slug || "",
);
const content = computed(() => translations.value?.content?.value || "");
const excerpt = computed(
  () => translations.value?.excerpt?.value || seo.value?.metaDescription || "",
);
</script>

<template>
  <div class="container mx-auto py-8 max-w-4xl">
    <div class="flex justify-between items-center mb-6">
      <div class="flex items-center gap-4">
        <NuxtLink to="/app/cms/blog/posts" class="btn btn-ghost btn-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back
        </NuxtLink>
        <h1 class="text-2xl font-bold">Preview</h1>
      </div>
      <div class="flex items-center gap-4">
        <select
          v-model="currentLang"
          class="select select-bordered"
          @change="handleLanguageChange"
        >
          <option v-for="loc in locales" :key="loc.code" :value="loc.code">
            {{ loc.name }}
          </option>
        </select>
        <NuxtLink
          :to="`/app/cms/blog/posts/${postId}/edit`"
          class="btn btn-primary btn-sm"
        >
          Edit
        </NuxtLink>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"/>
    </div>

    <div v-else-if="post" class="space-y-6">
      <div class="border-b pb-4">
        <h1 class="text-4xl font-bold mb-2">{{ title }}</h1>
        <div class="flex items-center gap-4 text-sm text-gray-500">
          <span v-if="post.isPublished" class="badge badge-success"
            >Published</span
          >
          <span v-else class="badge badge-warning">Draft</span>
          <span v-if="post.publishedAt"
            >Published:
            {{ new Date(post.publishedAt).toLocaleDateString() }}</span
          >
        </div>
      </div>

      <div v-if="excerpt" class="text-lg text-gray-600 italic">
        {{ excerpt }}
      </div>

      <div class="prose max-w-none" v-html="content"/>

      <div v-if="post.tags?.length" class="flex gap-2 mt-8">
        <span v-for="tag in post.tags" :key="tag" class="badge badge-outline">
          {{ tag }}
        </span>
      </div>
    </div>

    <div v-else class="text-center py-12 text-gray-500">Post not found</div>
  </div>
</template>
