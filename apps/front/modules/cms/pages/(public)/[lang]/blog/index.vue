<script setup lang="ts">
const route = useRoute();
const lang = computed(() => route.params.lang || 'es');

const { data: posts, pending } = await useFetch('/api/v1/cms/blog/posts/public', {
  query: { lang, page: 1, limit: 10 }
});
</script>

<template>
  <div class="container mx-auto py-12">
    <h1 class="text-4xl font-bold mb-8">Blog</h1>
    
    <div v-if="pending" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    
    <div v-else class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      <article v-for="post in posts?.data" :key="post.id" class="card bg-base-100 shadow-xl">
        <figure v-if="post.featuredImage">
          <img :src="post.featuredImage.url" :alt="post.slug" class="w-full h-48 object-cover" />
        </figure>
        <div class="card-body">
          <h2 class="card-title">
            <NuxtLink :to="`/${lang}/blog/${post.slug}`" class="hover:text-primary">
              {{ post.slug }}
            </NuxtLink>
          </h2>
          <p class="text-sm text-muted">
            {{ post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : '' }}
          </p>
          <div class="card-actions justify-end mt-4">
            <NuxtLink :to="`/${lang}/blog/${post.slug}`" class="btn btn-primary btn-sm">
              Read more
            </NuxtLink>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
