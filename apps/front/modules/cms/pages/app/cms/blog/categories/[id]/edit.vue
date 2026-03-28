<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: "auth",
});

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const {
  fetchCategory,
  updateCategory,
  deleteCategory,
  categories,
  fetchCategories,
  loading,
  error,
} = useCmsCategories();

const categoryId = route.params.id as string;
const isDeleting = ref(false);

const form = ref({
  name: "",
  slug: "",
  description: "",
  parentId: null as string | null,
});

onMounted(async () => {
  try {
    // Fetch all categories for parent selection
    await fetchCategories();

    // Fetch the specific category
    const category = await fetchCategory(categoryId);
    form.value = {
      name: category.name || "",
      slug: category.slug || "",
      description: category.description || "",
      parentId: category.parentId || null,
    };
  } catch (e) {
    console.error(e);
  }
});

const handleSubmit = async () => {
  try {
    await updateCategory(categoryId, {
      name: form.value.name,
      slug: form.value.slug,
      description: form.value.description || undefined,
      parentId: form.value.parentId,
    });
    router.push("/app/cms/blog/categories");
  } catch (e) {
    console.error(e);
  }
};

const handleDelete = async () => {
  if (isDeleting.value) return;

  const confirmed = confirm(t("cms.confirmDelete"));
  if (!confirmed) return;

  isDeleting.value = true;
  try {
    await deleteCategory(categoryId);
    router.push("/app/cms/blog/categories");
  } catch (e) {
    console.error(e);
    isDeleting.value = false;
  }
};

// Filter out current category and its descendants from parent options
const availableParents = computed(() => {
  const excludeIds = new Set<string>();
  const addDescendants = (id: string) => {
    excludeIds.add(id);
    categories.value
      .filter((c) => c.parentId === id)
      .forEach((c) => addDescendants(c.id));
  };
  addDescendants(categoryId);

  return categories.value.filter((c) => !excludeIds.has(c.id));
});
</script>

<template>
  <div class="container mx-auto py-8">
    <div class="flex justify-between items-center mb-8">
      <div class="flex items-center gap-4">
        <NuxtLink to="/app/cms/blog/categories" class="btn btn-ghost btn-sm">
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
        <h1 class="text-3xl font-bold">{{ t("cms.blog.categories.edit") }}</h1>
      </div>
      <div class="flex items-center gap-4">
        <button
          class="btn btn-ghost text-error"
          :disabled="isDeleting"
          @click="handleDelete"
        >
          {{ isDeleting ? t("cms.deleting") + "..." : t("cms.delete") }}
        </button>
        <NuxtLink to="/app/cms/blog/categories" class="btn btn-ghost">
          {{ t("cms.cancel") }}
        </NuxtLink>
      </div>
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

      <div class="form-control">
        <label class="label">
          <span class="label-text">{{ t("cms.blog.categories.parent") }}</span>
        </label>
        <select v-model="form.parentId" class="select select-bordered">
          <option :value="null">
            -- {{ t("cms.blog.categories.noParent") }} --
          </option>
          <option v-for="cat in availableParents" :key="cat.id" :value="cat.id">
            {{ cat.name }}
          </option>
        </select>
        <label class="label">
          <span class="label-text-alt">{{
            t("cms.blog.categories.parentHint")
          }}</span>
        </label>
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
