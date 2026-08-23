<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: "auth",
});

const { t } = useI18n();
</script>

<template>
  <div class="container mx-auto py-8">
    <h1 class="text-3xl font-bold mb-8">{{ t("mod.pages.blog.title") }}</h1>

    <div class="grid md:grid-cols-2 gap-6">
      <NuxtLink
        to="/app/cms/blog/posts"
        class="card bg-base-200 hover:bg-base-300 transition-colors"
      >
        <div class="card-body">
          <h2 class="card-title">{{ t("mod.pages.blog.posts.title") }}</h2>
          <p>{{ t("mod.pages.blog.description") }}</p>
        </div>
      </NuxtLink>

      <NuxtLink
        to="/app/cms/blog/categories"
        class="card bg-base-200 hover:bg-base-300 transition-colors"
      >
        <div class="card-body">
          <h2 class="card-title">{{ t("mod.pages.blog.categories.title") }}</h2>
          <p>{{ t("mod.pages.blog.categoriesDescription") }}</p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
