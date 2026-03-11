<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: "auth",
});

const { t, locale, locales } = useI18n();
const router = useRouter();
const route = useRoute();
const {
  fetchPost,
  updatePost,
  fetchTranslations,
  saveTranslation,
  fetchSeo,
  updateSeo,
  loading,
} = useCmsBlogPosts();

const postId = route.params.id as string;
const activeTab = ref("content");
const currentLang = ref(locale.value || "es");
const isLoadingTranslations = ref(false);

const form = ref({
  slug: "",
  author: "",
  categoryId: "",
  tags: [] as string[],
  isPublished: false,
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
});

const seoKeywordsInput = ref("");
const tagsInput = ref("");

const loadTranslations = async () => {
  isLoadingTranslations.value = true;
  try {
    const translations = await fetchTranslations(postId, currentLang.value);
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

    const seo = await fetchSeo(postId, currentLang.value);
    if (seo) {
      seoForm.value = {
        metaTitle: seo.metaTitle || "",
        metaDescription: seo.metaDescription || "",
        metaKeywords: seo.metaKeywords || [],
        canonicalUrl: seo.canonicalUrl || "",
      };
      seoKeywordsInput.value = (seo.metaKeywords || []).join(", ");
    } else {
      seoForm.value = {
        metaTitle: "",
        metaDescription: "",
        metaKeywords: [],
        canonicalUrl: "",
      };
      seoKeywordsInput.value = "";
    }
  } catch (e) {
    console.error("Error loading translations:", e);
  } finally {
    isLoadingTranslations.value = false;
  }
};

onMounted(async () => {
  try {
    const post = await fetchPost(postId);
    form.value = {
      slug: post.slug,
      author: post.author || "",
      categoryId: post.categoryId || "",
      tags: post.tags || [],
      isPublished: post.isPublished,
    };
    tagsInput.value = (post.tags || []).join(", ");

    await loadTranslations();
  } catch (e) {
    console.error(e);
  }
});

const handleLanguageChange = async () => {
  await loadTranslations();
};

const handleSubmit = async () => {
  try {
    const tags = tagsInput.value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    await updatePost(postId, {
      ...form.value,
      tags,
    });

    await saveTranslation(
      postId,
      currentLang.value,
      "title",
      translationForm.value.title,
    );
    await saveTranslation(
      postId,
      currentLang.value,
      "content",
      translationForm.value.content,
    );
    await saveTranslation(
      postId,
      currentLang.value,
      "excerpt",
      translationForm.value.excerpt,
    );

    await updateSeo(postId, {
      ...seoForm.value,
      metaKeywords: seoKeywordsInput.value
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    });

    router.push("/app/cms/blog/posts");
  } catch (e) {
    console.error(e);
  }
};
</script>

<template>
  <div class="container mx-auto py-8 max-w-5xl">
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-3xl font-bold">{{ t("cms.blog.posts.edit") }}</h1>
      <div class="flex items-center gap-4">
        <label class="flex items-center gap-2">
          <span class="text-sm">Language:</span>
          <select
            v-model="currentLang"
            @change="handleLanguageChange"
            class="select select-bordered select-sm"
            :disabled="isLoadingTranslations"
          >
            <option v-for="loc in locales" :key="loc.code" :value="loc.code">
              {{ loc.name }}
            </option>
          </select>
        </label>
        <span
          v-if="isLoadingTranslations"
          class="loading loading-spinner loading-sm"
        ></span>
      </div>
    </div>

    <div class="tabs tabs-boxed mb-6">
      <a
        class="tab"
        :class="{ 'tab-active': activeTab === 'content' }"
        @click="activeTab = 'content'"
      >
        {{ t("cms.blog.posts.content") }}
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
      <div v-show="activeTab === 'content'">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div class="form-control">
            <label class="label">
              <span class="label-text">{{ t("cms.blog.posts.slug") }}</span>
            </label>
            <input
              v-model="form.slug"
              type="text"
              class="input input-bordered"
              required
            />
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">{{ t("cms.blog.posts.author") }}</span>
            </label>
            <input
              v-model="form.author"
              type="text"
              class="input input-bordered"
            />
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">{{ t("cms.blog.posts.tags") }}</span>
            </label>
            <input
              v-model="tagsInput"
              type="text"
              class="input input-bordered"
              placeholder="tag1, tag2, tag3"
            />
          </div>

          <div class="form-control">
            <label class="label cursor-pointer">
              <span class="label-text">{{
                t("cms.blog.posts.published")
              }}</span>
              <input
                v-model="form.isPublished"
                type="checkbox"
                class="toggle"
              />
            </label>
          </div>
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
        </div>

        <div class="form-control mb-6">
          <label class="label">
            <span class="label-text">{{ t("cms.blog.posts.excerpt") }}</span>
          </label>
          <textarea
            v-model="translationForm.excerpt"
            class="textarea textarea-bordered"
            rows="2"
          ></textarea>
        </div>

        <div class="form-control mb-6">
          <label class="label">
            <span class="label-text">{{ t("cms.blog.posts.content") }}</span>
          </label>
          <RichEditorAdvanced
            v-model="translationForm.content"
            entity-name="BlogPost"
            :entity-id="postId"
            class="min-h-[400px]"
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
            placeholder="https://example.com/blog/post"
          />
        </div>
      </div>

      <div class="flex gap-4 pt-4">
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? "..." : t("cms.save") }}
        </button>
        <NuxtLink to="/app/cms/blog/posts" class="btn btn-ghost">
          {{ t("cms.cancel") }}
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
