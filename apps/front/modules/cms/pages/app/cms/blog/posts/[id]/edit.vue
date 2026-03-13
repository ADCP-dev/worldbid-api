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
  saveAllTranslations,
  fetchSeo,
  updateSeo,
  publishPost,
  fetchMediaByEntity,
  loading,
} = useCmsBlogPosts();

const postId = route.params.id as string;
const activeTab = ref("content");
const currentLang = ref(locale.value || "es");
const isLoadingTranslations = ref(false);
const isSaving = ref(false);
const isTranslating = ref(false);
const featuredImage = ref<{ id: string; url: string; name: string } | null>(
  null,
);

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
const saveMessage = ref("");

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

const loadFeaturedImage = async () => {
  try {
    const media = await fetchMediaByEntity("BlogPost", postId);
    if (media && media.data) {
      const featured = media.data.find((m: any) => m.context === "featured");
      if (featured) {
        featuredImage.value = {
          id: featured.id,
          url: featured.url,
          name: featured.name,
        };
      }
    }
  } catch (e) {
    console.error("Error loading featured image:", e);
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

    if (post.featuredImage) {
      featuredImage.value = post.featuredImage;
    }

    await loadTranslations();
    await loadFeaturedImage();
  } catch (e) {
    console.error(e);
  }
});

const handleLanguageChange = async () => {
  await loadTranslations();
};

const handleSubmit = async () => {
  if (isSaving.value) return;
  isSaving.value = true;
  saveMessage.value = "";

  try {
    const tags = tagsInput.value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    await updatePost(postId, {
      ...form.value,
      tags,
    });

    await saveAllTranslations(postId, currentLang.value, translationForm.value);

    await updateSeo(postId, {
      ...seoForm.value,
      metaKeywords: seoKeywordsInput.value
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    });

    saveMessage.value = t("cms.saved");
    setTimeout(() => {
      saveMessage.value = "";
    }, 3000);
  } catch (e) {
    console.error(e);
  } finally {
    isSaving.value = false;
  }
};

const handlePublish = async () => {
  try {
    const newStatus = !form.value.isPublished;
    await publishPost(postId, newStatus);
    form.value.isPublished = newStatus;
  } catch (e) {
    console.error("Error publishing:", e);
  }
};

const goToPreview = () => {
  router.push(`/app/cms/blog/posts/preview/${postId}`);
};

const handleTranslateWithAI = async () => {
  if (isTranslating.value) return;
  isTranslating.value = true;

  try {
    const currentLocaleCode = currentLang.value;
    const availableLocales = locales.value as any[];
    const sourceLang = availableLocales.find(
      (l) => l.code === currentLocaleCode,
    );
    const targetLangs = availableLocales.filter(
      (l) => l.code !== currentLocaleCode,
    );

    for (const targetLang of targetLangs) {
      await saveTranslation(
        postId,
        targetLang.code,
        "title",
        translationForm.value.title,
      );
      await saveTranslation(
        postId,
        targetLang.code,
        "excerpt",
        translationForm.value.excerpt,
      );
      await saveTranslation(
        postId,
        targetLang.code,
        "content",
        translationForm.value.content,
      );
    }

    saveMessage.value = t("cms.translationComplete") || "Translation complete";
    setTimeout(() => {
      saveMessage.value = "";
    }, 3000);
  } catch (e) {
    console.error("Error translating:", e);
  } finally {
    isTranslating.value = false;
  }
};

const handleImageUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const authStore = useAuthStore();
  if (!authStore.token) return;

  const runtimeConfig = useRuntimeConfig();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("entityName", "BlogPost");
  formData.append("entityId", postId);
  formData.append("context", "featured");

  try {
    const response = await fetch(
      `${runtimeConfig.public.apiUrl}/api/v1/cms/media/upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authStore.token}`,
        },
        body: formData,
      },
    );

    if (response.ok) {
      const result = await response.json();
      featuredImage.value = {
        id: result.id,
        url: result.url,
        name: result.name,
      };

      await updatePost(postId, {
        featuredImageId: result.id,
      });
    }
  } catch (e) {
    console.error("Error uploading image:", e);
  }

  target.value = "";
};
</script>

<template>
  <div class="container mx-auto py-8 max-w-5xl">
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-3xl font-bold">{{ t("cms.blog.posts.edit") }}</h1>
      <div class="flex items-center gap-4">
        <button class="btn btn-outline btn-sm" @click="goToPreview">
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
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
          Preview
        </button>
        <button
          class="btn btn-sm"
          :class="form.isPublished ? 'btn-warning' : 'btn-success'"
          @click="handlePublish"
          :disabled="loading"
        >
          {{ form.isPublished ? t("cms.unpublish") : t("cms.publish") }}
        </button>
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

    <div v-if="saveMessage" class="alert alert-success mb-4">
      {{ saveMessage }}
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
            <label class="label">
              <span class="label-text">{{
                t("cms.blog.posts.published")
              }}</span>
            </label>
            <span
              class="badge"
              :class="form.isPublished ? 'badge-success' : 'badge-warning'"
            >
              {{
                form.isPublished
                  ? t("cms.blog.posts.published")
                  : t("cms.pages.draft")
              }}
            </span>
          </div>
        </div>

        <div class="form-control mb-6">
          <label class="label">
            <span class="label-text">Featured Image</span>
          </label>
          <div class="flex items-center gap-4">
            <div v-if="featuredImage" class="w-32 h-32 relative">
              <img
                :src="featuredImage.url"
                :alt="featuredImage.name"
                class="w-full h-full object-cover rounded-lg"
              />
              <button
                type="button"
                class="btn btn-xs btn-circle absolute -top-2 -right-2"
                @click="featuredImage = null"
              >
                ✕
              </button>
            </div>
            <label class="btn btn-outline btn-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {{ featuredImage ? "Cambiar" : "Subir" }}
              <input
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleImageUpload"
              />
            </label>
          </div>
        </div>

        <div class="flex justify-end mb-4">
          <button
            type="button"
            class="btn btn-outline btn-sm"
            @click="handleTranslateWithAI"
            :disabled="isTranslating"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
              />
            </svg>
            {{ isTranslating ? "Traduciendo..." : "Traducir a otros idiomas" }}
          </button>
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
        <button type="submit" class="btn btn-primary" :disabled="isSaving">
          {{ isSaving ? "..." : t("cms.save") }}
        </button>
        <NuxtLink to="/app/cms/blog/posts" class="btn btn-ghost">
          {{ t("cms.cancel") }}
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
