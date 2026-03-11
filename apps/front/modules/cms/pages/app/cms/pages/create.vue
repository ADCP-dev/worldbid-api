<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'auth',
});

const { t } = useI18n();
const router = useRouter();
const { createPage, loading } = useCmsPages();

const form = ref({
  slug: '',
  route: '',
  template: 'generic',
  order: 0,
});

const templates = [
  { value: 'landing', label: 'Landing' },
  { value: 'generic', label: 'Generic' },
  { value: 'contact', label: 'Contact' },
];

const handleSubmit = async () => {
  try {
    await createPage(form.value);
    router.push('/app/cms/pages');
  } catch (error) {
    console.error(error);
  }
};
</script>

<template>
  <div class="container mx-auto py-8 max-w-2xl">
    <h1 class="text-3xl font-bold mb-8">{{ t('cms.pages.create') }}</h1>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <div class="form-control">
        <label class="label">
          <span class="label-text">{{ t('cms.pages.slug') }}</span>
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
          <span class="label-text">{{ t('cms.pages.route') }}</span>
        </label>
        <input 
          v-model="form.route" 
          type="text" 
          class="input input-bordered" 
          placeholder="/es/home"
        />
      </div>

      <div class="form-control">
        <label class="label">
          <span class="label-text">{{ t('cms.pages.template') }}</span>
        </label>
        <select v-model="form.template" class="select select-bordered">
          <option v-for="tpl in templates" :key="tpl.value" :value="tpl.value">
            {{ tpl.label }}
          </option>
        </select>
      </div>

      <div class="form-control">
        <label class="label">
          <span class="label-text">{{ t('cms.pages.order') }}</span>
        </label>
        <input 
          v-model.number="form.order" 
          type="number" 
          class="input input-bordered" 
          min="0"
        />
      </div>

      <div class="flex gap-4">
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? '...' : t('cms.save') }}
        </button>
        <NuxtLink to="/app/cms/pages" class="btn btn-ghost">
          {{ t('cms.cancel') }}
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
