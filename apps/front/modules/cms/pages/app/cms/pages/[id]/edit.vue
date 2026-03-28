<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: "auth",
});

const { t, locale, locales } = useI18n();
const router = useRouter();
const route = useRoute();
const {
  fetchPage,
  updatePage,
  fetchSeo,
  updateSeo,
  fetchTranslations,
  saveTranslation,
  saveAllTranslations,
  loading,
} = useCmsPages();

const pageId = route.params.id as string;
const activeTab = ref("content");

// Language management
const currentLang = ref(locale.value || "es");
const availableLangs = ref(["es", "en"]);

const form = ref({
  slug: "",
  route: "",
  template: "generic",
  order: 0,
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
      route: page.route || "",
      template: page.template || "generic",
      order: page.order || 0,
    };

    // Fetch translations for current language
    const translations = await fetchTranslations(pageId, currentLang.value);
    if (translations) {
      translationForm.value = {
        title: translations.title?.value || "",
        content: translations.content?.value || "",
        excerpt: translations.excerpt?.value || "",
      };
    }

    // Fetch SEO for current language
    const seo = await fetchSeo(pageId, currentLang.value);
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
    // Update page basic data
    await updatePage(pageId, {
      slug: form.value.slug,
      route: form.value.route,
      template: form.value.template,
      order: form.value.order,
    });

    // Save translations for current language
    await saveAllTranslations(pageId, currentLang.value, translationForm.value);

    // Save SEO
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
      currentLang.value,
    );

    router.push("/app/cms/pages");
  } catch (e) {
    console.error(e);
  }
};

const handleLangChange = async (lang: string) => {
  currentLang.value = lang;

  // Save current translations first
  await saveAllTranslations(pageId, currentLang.value, translationForm.value);

  // Fetch translations for new language
  const translations = await fetchTranslations(pageId, lang);
  if (translations) {
    translationForm.value = {
      title: translations.title?.value || "",
      content: translations.content?.value || "",
      excerpt: translations.excerpt?.value || "",
    };
  } else {
    translationForm.value = {
      title: "",
      content: "",
      excerpt: "",
    };
  }

  // Fetch SEO for new language
  const seo = await fetchSeo(pageId, lang);
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
};

// Handle AI translate - calls backend endpoint for dynamic entity translation
const handleTranslate = async ({
  field,
  targetLang,
}: {
  field: string;
  targetLang: string;
}) => {
  try {
    const runtimeConfig = useRuntimeConfig();
    const base = runtimeConfig.public.apiUrl;
    const authStore = useAuthStore();

    const response = await fetch(
      `${base}/api/v1/translations/translate-entity`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify({
          entityName: "Page",
          entityId: pageId,
          field,
          sourceLang: currentLang.value,
          targetLang,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Translation failed: ${response.statusText}`);
    }

    // Reload translations after successful translation
    const newTranslations = await fetchTranslations(pageId, targetLang);
    if (newTranslations && newTranslations[field]) {
      translationForm.value[field as keyof typeof translationForm.value] =
        newTranslations[field].value;
    }
  } catch (error) {
    console.error("Error translating field:", error);
  }
};

const templates = [
  { value: "landing", label: "Landing" },
  { value: "generic", label: "Generic" },
  { value: "contact", label: "Contact" },
];
</script>

<template>
  <div class="container mx-auto py-8 max-w-5xl">
    <div class="flex justify-between items-center mb-8">
      <div class="flex items-center gap-4">
        <NuxtLink to="/app/cms/pages" class="btn btn-ghost btn-sm">
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
        </NuxtLink>
        <h1 class="text-3xl font-bold">{{ t("cms.pages.edit") }}</h1>
      </div>
      <div class="flex items-center gap-4">
        <label class="flex items-center gap-2">
          <span class="text-sm">Language:</span>
          <select
            v-model="currentLang"
            class="select select-bordered select-sm"
            @change="handleLangChange(currentLang)"
          >
            <option v-for="loc in locales" :key="loc.code" :value="loc.code">
              {{ loc.name }}
            </option>
          </select>
        </label>
        <NuxtLink to="/app/cms/pages" class="btn btn-ghost">
          {{ t("cms.cancel") }}
        </NuxtLink>
      </div>
    </div>

    <div class="tabs tabs-boxed mb-6">
      <a
        class="tab"
        :class="{ 'tab-active': activeTab === 'content' }"
        @click="activeTab = 'content'"
      >
        {{ t("cms.pages.content") }}
      </a>
      <a
        class="tab"
        :class="{ 'tab-active': activeTab === 'settings' }"
        @click="activeTab = 'settings'"
      >
        {{ t("cms.pages.settings") }}
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
      <div v-show="activeTab === 'content'" class="space-y-6">
        <div class="form-control mb-6">
          <label class="label">
            <span class="label-text">{{ t("cms.pages.slug") }}</span>
          </label>
          <input
            v-model="form.slug"
            type="text"
            class="input input-bordered"
            required
          />
          <label class="label">
            <span class="label-text-alt"
              >URL: /{{ currentLang }}/page/{{ form.slug || "slug" }}</span
            >
          </label>
        </div>

        <div class="form-control mb-6">
          <label class="label">
            <span class="label-text">Título</span>
          </label>
          <input
            v-model="translationForm.title"
            type="text"
            class="input input-bordered"
          />
          <button
            type="button"
            class="btn btn-ghost btn-sm mt-2"
            @click="
              handleTranslate({
                field: 'title',
                targetLang: currentLang === 'es' ? 'en' : 'es',
              })
            "
          >
            Translate with AI
          </button>
        </div>

        <div class="form-control mb-6">
          <label class="label">
            <span class="label-text">{{ t("cms.pages.excerpt") }}</span>
          </label>
          <textarea
            v-model="translationForm.excerpt"
            class="textarea textarea-bordered"
            rows="2"
          ></textarea>
          <button
            type="button"
            class="btn btn-ghost btn-sm mt-2"
            @click="
              handleTranslate({
                field: 'excerpt',
                targetLang: currentLang === 'es' ? 'en' : 'es',
              })
            "
          >
            Translate with AI
          </button>
        </div>

        <div class="form-control mb-6">
          <label class="label">
            <span class="label-text">{{ t("cms.pages.content") }}</span>
          </label>
          <RichEditorAdvanced
            v-model="translationForm.content"
            entity-name="Page"
            :entity-id="pageId"
            class="min-h-[400px]"
          />
        </div>
      </div>

      <div v-show="activeTab === 'settings'" class="space-y-6 max-w-xl">
        <div class="form-control">
          <label class="label">
            <span class="label-text">{{ t("cms.pages.route") }}</span>
          </label>
          <input
            v-model="form.route"
            type="text"
            class="input input-bordered"
            placeholder="/es/home"
          />
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text">{{ t("cms.pages.template") }}</span>
          </label>
          <select v-model="form.template" class="select select-bordered">
            <option
              v-for="tpl in templates"
              :key="tpl.value"
              :value="tpl.value"
            >
              {{ tpl.label }}
            </option>
          </select>
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text">{{ t("cms.pages.order") }}</span>
          </label>
          <input
            v-model.number="form.order"
            type="number"
            class="input input-bordered"
            min="0"
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
