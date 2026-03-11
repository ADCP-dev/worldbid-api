<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: "auth",
});

const { t } = useI18n();
const { categories, loading, fetchCategories, deleteCategory } =
  useCmsCategories();

onMounted(() => {
  fetchCategories();
});

const handleDelete = async (id: string) => {
  if (confirm(t("cms.confirmDelete"))) {
    await deleteCategory(id);
  }
};
</script>

<template>
  <div class="container mx-auto py-8">
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-3xl font-bold">{{ t("cms.blog.categories.title") }}</h1>
      <NuxtLink to="/app/cms/blog/categories/create" class="btn btn-primary">
        {{ t("cms.blog.categories.create") }}
      </NuxtLink>
    </div>

    <div v-if="loading" class="flex justify-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else-if="categories.length === 0" class="text-center py-8">
      <p class="text-gray-500">{{ t("cms.blog.categories.title") }}</p>
    </div>

    <div v-else class="overflow-x-auto">
      <table class="table">
        <thead>
          <tr>
            <th>{{ t("cms.blog.categories.name") }}</th>
            <th>{{ t("cms.blog.categories.description") }}</th>
            <th>{{ t("cms.blog.posts.actions") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="category in categories" :key="category.id">
            <td>{{ category.name }}</td>
            <td>{{ category.description || "-" }}</td>
            <td>
              <div class="flex gap-2">
                <NuxtLink
                  :to="`/app/cms/blog/categories/${category.id}/edit`"
                  class="btn btn-sm btn-ghost"
                >
                  {{ t("cms.blog.posts.edit") }}
                </NuxtLink>
                <button
                  class="btn btn-sm btn-ghost text-error"
                  @click="handleDelete(category.id)"
                >
                  {{ t("cms.delete") }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
