<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: "auth",
});

const { t, locale } = useI18n();
const router = useRouter();
const { posts, loading, fetchPosts, publishPost, deletePost, fetchPreview } =
  useCmsBlogPosts();

const config = useRuntimeConfig();

onMounted(() => {
  fetchPosts();
});

const handlePublish = async (id: string, isPublished: boolean) => {
  await publishPost(id, isPublished);
};

const handleDelete = async (id: string) => {
  if (confirm(t("cms.confirmDelete"))) {
    await deletePost(id);
  }
};

const handlePreview = async (id: string) => {
  try {
    const post = await fetchPreview(id);
    const previewUrl = `/app/cms/blog/posts/preview/${id}`;
    router.push(previewUrl);
  } catch (e) {
    console.error("Error loading preview:", e);
  }
};

const getViewUrl = (slug: string) => {
  return `/${locale.value}/blog/${slug}`;
};
</script>

<template>
  <div class="container mx-auto py-8">
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-3xl font-bold">{{ t("cms.blog.posts.title") }}</h1>
      <NuxtLink to="/app/cms/blog/posts/create" class="btn btn-primary">
        {{ t("cms.blog.posts.create") }}
      </NuxtLink>
    </div>

    <div v-if="loading" class="flex justify-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else-if="posts.length === 0" class="text-center py-8">
      <p class="text-gray-500">{{ t("cms.blog.posts.title") }}</p>
    </div>

    <div v-else class="overflow-x-auto">
      <table class="table">
        <thead>
          <tr>
            <th>{{ t("cms.blog.posts.slug") }}</th>
            <th>{{ t("cms.blog.posts.tags") }}</th>
            <th>{{ t("cms.blog.posts.published") }}</th>
            <th>{{ t("cms.blog.posts.actions") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="post in posts" :key="post.id">
            <td>{{ post.slug }}</td>
            <td>{{ post.tags?.join(", ") || "-" }}</td>
            <td>
              <span
                class="badge"
                :class="post.isPublished ? 'badge-success' : 'badge-warning'"
              >
                {{
                  post.isPublished
                    ? t("cms.blog.posts.published")
                    : t("cms.pages.draft")
                }}
              </span>
            </td>
            <td>
              <div class="flex gap-2">
                <button
                  class="btn btn-sm btn-ghost"
                  @click="handlePreview(post.id)"
                  title="Preview"
                >
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
                </button>
                <a
                  v-if="post.isPublished"
                  :href="getViewUrl(post.slug)"
                  target="_blank"
                  class="btn btn-sm btn-ghost"
                  title="View on site"
                >
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
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
                <button
                  class="btn btn-sm btn-ghost"
                  @click="handlePublish(post.id, !post.isPublished)"
                >
                  {{
                    post.isPublished
                      ? t("cms.pages.draft")
                      : t("cms.blog.posts.published")
                  }}
                </button>
                <NuxtLink
                  :to="`/app/cms/blog/posts/${post.id}/edit`"
                  class="btn btn-sm btn-ghost"
                >
                  {{ t("cms.blog.posts.edit") }}
                </NuxtLink>
                <button
                  class="btn btn-sm btn-ghost text-error"
                  @click="handleDelete(post.id)"
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
