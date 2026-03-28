<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: "auth",
});

const { t, locale, locales } = useI18n();
const router = useRouter();
const { createPage, saveAllTranslations, loading, error } = useCmsPages();

const activeTab = ref("content");
const currentLang = ref(locale.value || "es");
const isCreating = ref(false);

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

const templates = [
  { value: "landing", label: "Landing" },
  { value: "generic", label: "Generic" },
  { value: "contact", label: "Contact" },
];

const handleSubmit = async () => {
  if (isCreating.value) return;
  isCreating.value = true;

  try {
    const page = await createPage({
      ...form.value,
      isPublished: false,
    });

    await saveAllTranslations(
      page.id,
      currentLang.value,
      translationForm.value,
    );

    router.push(`/app/cms/pages/${page.id}/edit`);
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
        <h1 class="text-3xl font-bold">{{ t("cms.pages.create") }}</h1>
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
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <div v-show="activeTab === 'content'">
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
            <span class="label-text">{{ t("cms.pages.excerpt") }}</span>
          </label>
          <textarea
            v-model="translationForm.excerpt"
            class="textarea textarea-bordered"
            rows="2"
          ></textarea>
        </div>

        <div class="form-control mb-6">
          <label class="label">
            <span class="label-text">{{ t("cms.pages.content") }}</span>
          </label>
          <RichEditorAdvanced
            v-model="translationForm.content"
            entity-name="Page"
            :entity-id="''"
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

      <div v-if="error" class="alert alert-error">
        {{ error }}
      </div>

      <div class="flex gap-4">
        <button
          type="submit"
          class="btn btn-primary"
          :disabled="loading || isCreating"
        >
          {{ loading ? t("cms.save") + "..." : t("cms.save") }}
        </button>
        <NuxtLink to="/app/cms/pages" class="btn btn-ghost">
          {{ t("cms.cancel") }}
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
