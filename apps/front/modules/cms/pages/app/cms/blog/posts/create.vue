<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: "auth",
});

const { t, locale, locales } = useI18n();
const router = useRouter();
const { createPost, saveAllTranslations, loading, error } = useCmsBlogPosts();

const activeTab = ref("content");
const currentLang = ref(locale.value || "es");
const createdPostId = ref<string | null>(null);
const isCreating = ref(false);

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

const tagsInput = ref("");

const handleSubmit = async () => {
  if (isCreating.value) return;
  isCreating.value = true;

  try {
    const tags = tagsInput.value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const post = await createPost({
      ...form.value,
      tags,
      isPublished: false,
    });

    await saveAllTranslations(
      post.id,
      currentLang.value,
      translationForm.value,
    );

    router.push(`/app/cms/blog/posts/${post.id}/edit`);
  } catch (e) {
    console.error(e);
    isCreating.value = false;
  }
};
</script>

<template>
  <div class="container mx-auto py-8 max-w-5xl">
    <div class="flex justify-between items-center mb-8">
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
        </NuxtLink>
        <h1 class="text-3xl font-bold">{{ t("cms.blog.posts.create") }}</h1>
      </div>
      <div class="flex items-center gap-4">
        <label class="flex items-center gap-2">
          <span class="text-sm">Language:</span>
          <select
            v-model="currentLang"
            class="select select-bordered select-sm"
          >
            <option v-for="loc in locales" :key="loc.code" :value="loc.code">
              {{ loc.name }}
            </option>
          </select>
        </label>
        <NuxtLink to="/app/cms/blog/posts" class="btn btn-ghost">
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
            class="min-h-[400px]"
          />
        </div>
      </div>

      <div v-show="activeTab === 'seo'" class="space-y-6">
        <div class="alert alert-info">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>El SEO se puede configurar después de crear la entrada.</span>
        </div>
      </div>

      <div v-if="error" class="alert alert-error">
        {{ error }}
      </div>

      <div class="flex gap-4">
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? t("cms.save") + "..." : t("cms.save") }}
        </button>
        <NuxtLink to="/app/cms/blog/posts" class="btn btn-ghost">
          {{ t("cms.cancel") }}
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
