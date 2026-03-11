<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'auth',
});

const { t } = useI18n();
const { pages, loading, fetchPages, publishPage, deletePage } = useCmsPages();

onMounted(() => {
  fetchPages();
});

const handlePublish = async (id: string, isPublished: boolean) => {
  await publishPage(id, isPublished);
};

const handleDelete = async (id: string) => {
  if (confirm(t('cms.confirmDelete'))) {
    await deletePage(id);
  }
};
</script>

<template>
  <div class="container mx-auto py-8">
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-3xl font-bold">{{ t('cms.pages.title') }}</h1>
      <NuxtLink to="/app/cms/pages/create" class="btn btn-primary">
        {{ t('cms.pages.create') }}
      </NuxtLink>
    </div>

    <div v-if="loading" class="flex justify-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else class="overflow-x-auto">
      <table class="table">
        <thead>
          <tr>
            <th>{{ t('cms.pages.slug') }}</th>
            <th>{{ t('cms.pages.route') }}</th>
            <th>{{ t('cms.pages.template') }}</th>
            <th>{{ t('cms.pages.order') }}</th>
            <th>{{ t('cms.pages.published') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="page in pages" :key="page.id">
            <td>{{ page.slug }}</td>
            <td>{{ page.route || '-' }}</td>
            <td>{{ page.template }}</td>
            <td>{{ page.order }}</td>
            <td>
              <span 
                class="badge"
                :class="page.isPublished ? 'badge-success' : 'badge-warning'"
              >
                {{ page.isPublished ? t('cms.pages.published') : t('cms.pages.draft') }}
              </span>
            </td>
            <td>
              <div class="flex gap-2">
                <button 
                  class="btn btn-sm btn-ghost"
                  @click="handlePublish(page.id, !page.isPublished)"
                >
                  {{ page.isPublished ? t('cms.pages.draft') : t('cms.pages.published') }}
                </button>
                <NuxtLink :to="`/app/cms/pages/${page.id}/edit`" class="btn btn-sm btn-ghost">
                  Edit
                </NuxtLink>
                <button 
                  class="btn btn-sm btn-ghost text-error"
                  @click="handleDelete(page.id)"
                >
                  {{ t('cms.delete') }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
