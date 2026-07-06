<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { toast } from 'vue-sonner';
import { FileText, Newspaper, FolderTree, Tag, ArrowRight } from 'lucide-vue-next';

const pagesComposable = useCmsPages();
const postsComposable = useCmsBlogPosts();
const categoriesComposable = useCmsCategories();
const tagsComposable = useCmsTags();

const loading = ref(true);

const kpis = computed(() => {
  return [
    {
      label: 'Páginas',
      value: pagesComposable.pages.value.length,
      color: 'text-primary',
      icon: FileText,
    },
    {
      label: 'Posts',
      value: postsComposable.posts.value.length,
      color: 'text-info',
      icon: Newspaper,
    },
    {
      label: 'Categorías',
      value: categoriesComposable.categories.value.length,
      color: 'text-warning',
      icon: FolderTree,
    },
    {
      label: 'Tags',
      value: tagsComposable.tags.value.length,
      color: 'text-success',
      icon: Tag,
    },
  ];
});

const recentPages = computed(() =>
  [...pagesComposable.pages.value].slice(0, 5),
);

const recentPosts = computed(() =>
  [...postsComposable.posts.value].slice(0, 5),
);

function formatDate(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

onMounted(async () => {
  loading.value = true;
  try {
    await Promise.all([
      pagesComposable.fetchPages({ limit: 100 }),
      postsComposable.fetchPosts({ limit: 100 }),
      categoriesComposable.fetchCategories(),
      tagsComposable.fetchTags({ limit: 100 }),
    ]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    toast.error('Error cargando dashboard CMS', { description: msg });
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold">CMS Dashboard</h2>
      <NuxtLink to="/app/cms" class="btn btn-primary btn-sm">
        Gestionar CMS
      </NuxtLink>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <template v-else>
      <!-- KPIs -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          v-for="kpi in kpis"
          :key="kpi.label"
          class="stat bg-base-100 rounded-box shadow-sm border border-base-300"
        >
          <div class="stat-figure text-primary">
            <component :is="kpi.icon" class="w-6 h-6" />
          </div>
          <div class="stat-title">{{ kpi.label }}</div>
          <div class="stat-value" :class="kpi.color">{{ kpi.value }}</div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Recent pages -->
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h3 class="card-title">Páginas recientes</h3>
            <div v-if="recentPages.length === 0" class="text-sm text-base-content/40">
              Sin páginas
            </div>
            <ul v-else class="divide-y divide-base-200">
              <li
                v-for="page in recentPages"
                :key="page.id"
                class="flex items-center justify-between py-2"
              >
                <div class="min-w-0">
                  <div class="text-sm font-medium truncate">{{ page.title }}</div>
                  <div class="text-xs text-base-content/60">{{ page.route }}</div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span
                    class="badge badge-sm"
                    :class="page.isPublished ? 'badge-success' : 'badge-ghost'"
                  >
                    {{ page.isPublished ? 'Publicado' : 'Borrador' }}
                  </span>
                  <NuxtLink
                    :to="`/app/cms/pages/${page.id}/edit`"
                    class="btn btn-ghost btn-xs"
                  >
                    <ArrowRight class="w-3 h-3" />
                  </NuxtLink>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <!-- Recent posts -->
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h3 class="card-title">Posts recientes</h3>
            <div v-if="recentPosts.length === 0" class="text-sm text-base-content/40">
              Sin posts
            </div>
            <ul v-else class="divide-y divide-base-200">
              <li
                v-for="post in recentPosts"
                :key="post.id"
                class="flex items-center justify-between py-2"
              >
                <div class="min-w-0">
                  <div class="text-sm font-medium truncate">{{ post.slug }}</div>
                  <div class="text-xs text-base-content/60">
                    {{ post.author }} · {{ formatDate(post.publishedAt) }}
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span
                    class="badge badge-sm"
                    :class="post.isPublished ? 'badge-success' : 'badge-ghost'"
                  >
                    {{ post.isPublished ? 'Publicado' : 'Borrador' }}
                  </span>
                  <NuxtLink
                    :to="`/app/cms/blog/posts/${post.id}/edit`"
                    class="btn btn-ghost btn-xs"
                  >
                    <ArrowRight class="w-3 h-3" />
                  </NuxtLink>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>