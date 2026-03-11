<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'auth',
});

const { t } = useI18n();
</script>

<template>
  <div class="container mx-auto py-8">
    <h1 class="text-3xl font-bold mb-8">{{ t('cms.title') }}</h1>
    
    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <NuxtLink 
        to="/app/cms/pages" 
        class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow"
      >
        <div class="card-body">
          <h2 class="card-title">{{ t('cms.pages.title') }}</h2>
          <p>{{ t('cms.pages.description') }}</p>
        </div>
      </NuxtLink>
      
      <NuxtLink 
        to="/app/cms/blog/posts" 
        class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow"
      >
        <div class="card-body">
          <h2 class="card-title">{{ t('cms.blog.title') }}</h2>
          <p>{{ t('cms.blog.description') }}</p>
        </div>
      </NuxtLink>
      
      <NuxtLink 
        to="/app/cms/blog/categories" 
        class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow"
      >
        <div class="card-body">
          <h2 class="card-title">{{ t('cms.categories.title') }}</h2>
          <p>{{ t('cms.categories.description') }}</p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
