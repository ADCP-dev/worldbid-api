<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'auth',
});

const { t } = useI18n();
</script>

<template>
  <div class="container mx-auto py-8">
    <h1 class="text-3xl font-bold mb-8">{{ t('pages.common.cmsTitle') }}</h1>
    
    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <NuxtLink 
        to="/app/cms/pages" 
        class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow"
      >
        <div class="card-body">
          <h2 class="card-title">{{ t('pages.pages.title') }}</h2>
          <p>{{ t('pages.pages.description') }}</p>
        </div>
      </NuxtLink>
      
      <NuxtLink 
        to="/app/cms/blog/posts" 
        class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow"
      >
        <div class="card-body">
          <h2 class="card-title">{{ t('pages.blog.title') }}</h2>
          <p>{{ t('pages.blog.description') }}</p>
        </div>
      </NuxtLink>
      
      <NuxtLink 
        to="/app/cms/blog/categories" 
        class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow"
      >
        <div class="card-body">
          <h2 class="card-title">{{ t('pages.blog.categories.title') }}</h2>
          <p>{{ t('pages.blog.categoriesDescription') }}</p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
