<script setup lang="ts">
import FormInput from "@base/ui-app/components/form/FormInput.vue";
import FormTextArea from "@base/ui-app/components/form/FormTextArea.vue";
import { categorySchema } from "@cms/schemas/category.schema";
import { toast } from "vue-sonner";

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
const validationErrors = ref<Record<string, string>>({});
const allOpen = ref(false);

const languages = [
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

const translations = ref<Record<string, { name: string; description: string; slug: string }>>({
  es: { name: "", description: "", slug: "" },
  en: { name: "", description: "", slug: "" },
});

const parentId = ref<string | null>(null);

function kebabCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Auto-generate slug from name per language
const slugManuallyEdited = ref<Record<string, boolean>>({});
watch(
  () => languages.map(l => translations.value[l.code]?.name),
  (newVals) => {
    languages.forEach((lang, i) => {
      if (!slugManuallyEdited.value[lang.code]) {
        translations.value[lang.code].slug = kebabCase(newVals[i] || '');
      }
    });
  },
);

onMounted(async () => {
  try {
    await fetchCategories();
    const category = await fetchCategory(categoryId);
    
    translations.value.es.name = category.name || "";
    translations.value.es.description = category.description || "";
    translations.value.es.slug = category.slug || "";
    parentId.value = category.parentId || null;
    
    // TODO: Fetch translations for other languages when API supports it
  } catch (e) {
    // Silent error
  }
});

const toggleAll = () => {
  allOpen.value = !allOpen.value;
  const details = document.querySelectorAll('details[name="category-accordion"]');
  details.forEach((detail) => {
    if (allOpen.value) {
      detail.setAttribute("open", "");
    } else {
      detail.removeAttribute("open");
    }
  });
};

const handleSubmit = async () => {
  const dataToValidate = {
    name: translations.value.es.name,
    slug: translations.value.es.slug,
  };

  const result = categorySchema.safeParse(dataToValidate);
  if (!result.success) {
    validationErrors.value = {};
    result.error.errors.forEach((err) => {
      validationErrors.value[err.path[0]] = err.message;
    });
    return;
  }

  try {
    await updateCategory(categoryId, {
      name: translations.value.es.name,
      slug: translations.value.es.slug,
      description: translations.value.es.description || undefined,
      parentId: parentId.value,
    });

    toast.success("Categoría actualizada correctamente");
    router.push("/app/cms/blog/categories");
  } catch (e) {
    toast.error((e as any)?.message || "Error al guardar");
  }
};

const handleDelete = async () => {
  if (isDeleting.value) return;
  const confirmed = confirm(t("mod.pages.common.confirmDelete"));
  if (!confirmed) return;

  isDeleting.value = true;
  try {
    await deleteCategory(categoryId);
    router.push("/app/cms/blog/categories");
  } catch (e) {
    isDeleting.value = false;
  }
};

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
  <div class="container mx-auto py-8 max-w-3xl">
    <!-- Header -->
    <div class="flex justify-between items-center mb-8">
      <div class="flex items-center gap-4">
        <NuxtLink to="/app/cms/blog/categories" class="btn btn-ghost btn-sm">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </NuxtLink>
        <h1 class="text-3xl font-bold">{{ t("mod.pages.blog.categories.edit") }}</h1>
      </div>
      <div class="flex items-center gap-4">
        <button type="button" class="btn btn-sm btn-outline" @click="toggleAll">
          {{ allOpen ? 'Colapsar todo' : 'Expandir todo' }}
        </button>
        <button class="btn btn-ghost text-error" :disabled="isDeleting" @click="handleDelete">
          {{ isDeleting ? t("mod.pages.common.deleting") + "..." : t("mod.pages.common.delete") }}
        </button>
        <NuxtLink to="/app/cms/blog/categories" class="btn btn-ghost">
          {{ t("mod.pages.common.cancel") }}
        </NuxtLink>
      </div>
    </div>

    <form class="space-y-4" @submit.prevent="handleSubmit">
      <!-- Accordion per language -->
      <div class="join join-vertical w-full">
        <details
          v-for="lang in languages"
          :key="lang.code"
          class="collapse collapse-arrow join-item border border-base-300 bg-base-100"
          :open="lang.code === 'es'"
        >
          <summary class="collapse-title font-semibold">
            <span class="mr-2">{{ lang.flag }}</span>
            {{ lang.label }}
            <span v-if="lang.code === 'es'" class="badge badge-sm badge-primary ml-2">Por defecto</span>
          </summary>
          <div class="collapse-content">
            <div class="space-y-4 pt-2">
              <!-- Name -->
              <FormInput
                v-model="translations[lang.code].name"
                :label="t('mod.pages.blog.categories.name')"
                required
                placeholder="en minúsculas, ej: mi-categoria"
                :error="lang.code === 'es' ? validationErrors.name : undefined"
              />

              <!-- Slug per language -->
              <FormInput
                v-model="translations[lang.code].slug"
                label="Slug"
                placeholder="Se genera en minúsculas desde el nombre"
                required
                :error="lang.code === 'es' ? validationErrors.slug : undefined"
                @focus="slugManuallyEdited[lang.code] = true"
              />

              <!-- Description -->
              <FormTextArea
                v-model="translations[lang.code].description"
                :label="t('mod.pages.blog.categories.description')"
                :rows="3"
              />

              <!-- Parent (only on default lang) -->
              <div v-if="lang.code === 'es'">
                <label class="label-text font-semibold mb-1 block">{{ t("mod.pages.blog.categories.parent") }}</label>
                <select v-model="parentId" class="select select-bordered w-full">
                  <option :value="null">-- {{ t("mod.pages.blog.categories.noParent") }} --</option>
                  <option v-for="cat in availableParents" :key="cat.id" :value="cat.id">
                    {{ cat.name }}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </details>
      </div>

      <div v-if="error" class="alert alert-error">
        {{ error }}
      </div>

      <div class="flex gap-4 pt-4">
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? t("mod.pages.common.save") + "..." : t("mod.pages.common.save") }}
        </button>
        <NuxtLink to="/app/cms/blog/categories" class="btn btn-ghost">
          {{ t("mod.pages.common.cancel") }}
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
