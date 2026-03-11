<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: "auth",
});

const { t, locale } = useI18n();
const router = useRouter();
const route = useRoute();
const {
  fetchPage,
  updatePage,
  fetchSeo,
  updateSeo,
  fetchTranslations,
  saveTranslation,
  loading,
} = useCmsPages();

const pageId = route.params.id as string;
const activeTab = ref("translations");

const form = ref({
  slug: "",
});

const translationForm = ref({
  title: "",
  content: "",
  excerpt: "",
});

const seoForm = ref({
  metaTitle: "",
  metaDescription: "",
  metaKeywords: [] as string[],
  canonicalUrl: "",
  ogImageUrl: "",
});

const seoKeywordsInput = ref("");

onMounted(async () => {
  try {
    const page = await fetchPage(pageId);
    form.value = {
      slug: page.slug,
    };

    const translations = await fetchTranslations(pageId, locale.value);
    if (translations) {
      translationForm.value = {
        title: translations.title?.value || "",
        content: translations.content?.value || "",
        excerpt: translations.excerpt?.value || "",
      };
    }

    const seo = await fetchSeo(pageId, locale.value);
    if (seo) {
      seoForm.value = {
        metaTitle: seo.metaTitle || "",
        metaDescription: seo.metaDescription || "",
        metaKeywords: seo.metaKeywords || [],
        canonicalUrl: seo.canonicalUrl || "",
        ogImageUrl: seo.ogImage?.url || "",
      };
      seoKeywordsInput.value = (seo.metaKeywords || []).join(", ");
    }
  } catch (e) {
    console.error(e);
  }
});

const handleSubmit = async () => {
  try {
    await updatePage(pageId, form.value);

    await saveTranslation(
      pageId,
      locale.value,
      "title",
      translationForm.value.title,
    );
    await saveTranslation(
      pageId,
      locale.value,
      "content",
      translationForm.value.content,
    );
    await saveTranslation(
      pageId,
      locale.value,
      "excerpt",
      translationForm.value.excerpt,
    );

    await updateSeo(
      pageId,
      {
        metaTitle: seoForm.value.metaTitle,
        metaDescription: seoForm.value.metaDescription,
        metaKeywords: seoKeywordsInput.value
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        canonicalUrl: seoForm.value.canonicalUrl,
      },
      locale.value,
    );
    router.push("/app/cms/pages");
  } catch (e) {
    console.error(e);
  }
};
</script>

<template>
  <div class="container mx-auto py-8 max-w-4xl">
    <h1 class="text-3xl font-bold mb-8">{{ t("cms.pages.edit") }}</h1>

    <div class="tabs tabs-boxed mb-6">
      <a
        class="tab"
        :class="{ 'tab-active': activeTab === 'translations' }"
        @click="activeTab = 'translations'"
      >
        {{ t("cms.pages.title") }}
      </a>
      <a
        class="tab"
        :class="{ 'tab-active': activeTab === 'seo' }"
        @click="activeTab = 'seo'"
      >
        {{ t("cms.seo.title") }}
      </a>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <div v-show="activeTab === 'translations'" class="space-y-6">
        <div class="form-control">
          <label class="label">
            <span class="label-text"
              >{{ t("cms.pages.slug") }} ({{ t("cms.pages.route") }})</span
            >
          </label>
          <input
            v-model="form.slug"
            type="text"
            class="input input-bordered"
            required
          />
          <label class="label">
            <span class="label-text-alt"
              >URL: /{{ locale }}/page/{{ form.slug || "slug" }}</span
            >
          </label>
        </div>

        <div class="divider">Traducciones ({{ locale }})</div>

        <div class="form-control">
          <label class="label">
            <span class="label-text">Título</span>
          </label>
          <input
            v-model="translationForm.title"
            type="text"
            class="input input-bordered"
          />
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text">{{ t("cms.blog.posts.excerpt") }}</span>
          </label>
          <textarea
            v-model="translationForm.excerpt"
            class="textarea textarea-bordered"
            rows="2"
          ></textarea>
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text">{{ t("cms.blog.posts.content") }}</span>
          </label>
          <RichEditorAdvanced
            v-model="translationForm.content"
            class="min-h-[300px]"
          />
        </div>
      </div>

      <div v-show="activeTab === 'seo'" class="space-y-6">
        <div class="form-control">
          <label class="label">
            <span class="label-text">{{ t("cms.seo.metaTitle") }}</span>
          </label>
          <input
            v-model="seoForm.metaTitle"
            type="text"
            class="input input-bordered"
          />
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text">{{ t("cms.seo.metaDescription") }}</span>
          </label>
          <textarea
            v-model="seoForm.metaDescription"
            class="textarea textarea-bordered"
            rows="3"
          ></textarea>
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text">{{ t("cms.seo.metaKeywords") }}</span>
          </label>
          <input
            v-model="seoKeywordsInput"
            type="text"
            class="input input-bordered"
            placeholder="keyword1, keyword2, keyword3"
          />
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text">{{ t("cms.seo.canonicalUrl") }}</span>
          </label>
          <input
            v-model="seoForm.canonicalUrl"
            type="text"
            class="input input-bordered"
            placeholder="https://example.com/page"
          />
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text">{{ t("cms.seo.ogImage") }}</span>
          </label>
          <input
            v-model="seoForm.ogImageUrl"
            type="text"
            class="input input-bordered"
            placeholder="https://example.com/image.jpg"
          />
        </div>
      </div>

      <div class="flex gap-4 pt-4">
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? "..." : t("cms.save") }}
        </button>
        <NuxtLink to="/app/cms/pages" class="btn btn-ghost">
          {{ t("cms.cancel") }}
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
