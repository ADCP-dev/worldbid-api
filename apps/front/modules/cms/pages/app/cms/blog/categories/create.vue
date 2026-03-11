<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: "auth",
});

const { t } = useI18n();
const router = useRouter();
const { createCategory, loading, error } = useCmsCategories();

const form = ref({
  name: "",
  description: "",
  slug: "",
});

const handleSubmit = async () => {
  try {
    await createCategory(form.value);
    router.push("/app/cms/blog/categories");
  } catch (e) {
    console.error(e);
  }
};
</script>

<template>
  <div class="container mx-auto py-8">
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-3xl font-bold">{{ t("cms.blog.categories.create") }}</h1>
      <NuxtLink to="/app/cms/blog/categories" class="btn btn-ghost">
        {{ t("cms.cancel") }}
      </NuxtLink>
    </div>

    <form @submit.prevent="handleSubmit" class="max-w-2xl space-y-6">
      <div class="form-control">
        <label class="label">
          <span class="label-text">{{ t("cms.blog.categories.name") }}</span>
        </label>
        <input
          v-model="form.name"
          type="text"
          class="input input-bordered"
          required
        />
      </div>

      <div class="form-control">
        <label class="label">
          <span class="label-text">Slug</span>
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
          <span class="label-text">{{
            t("cms.blog.categories.description")
          }}</span>
        </label>
        <textarea
          v-model="form.description"
          class="textarea textarea-bordered"
          rows="3"
        ></textarea>
      </div>

      <div v-if="error" class="alert alert-error">
        {{ error }}
      </div>

      <div class="flex gap-4">
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? t("cms.save") + "..." : t("cms.save") }}
        </button>
        <NuxtLink to="/app/cms/blog/categories" class="btn btn-ghost">
          {{ t("cms.cancel") }}
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
