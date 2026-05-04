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
const { createCategory, loading, error } = useCmsCategories();

const validationErrors = ref<Record<string, string>>({});
const allOpen = ref(true);

// Active languages
const languages = [
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

// Translations structure: each lang has name, slug and description
const translations = ref<Record<string, { name: string; slug: string; description: string }>>({
  es: { name: "", slug: "", description: "" },
  en: { name: "", slug: "", description: "" },
});

// Auto-generate slug from Spanish name
const slugManuallyEdited = false;
watch(
  () => translations.value.es.name,
  (newVal) => {
    if (!slugManuallyEdited || !translations.value.es.slug) {
      translations.value.es.slug = kebabCase(newVal);
    }
  },
);

function kebabCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const toggleAll = () => {
  allOpen.value = !allOpen.value;
  const details = document.querySelectorAll('.collapse');
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
    await createCategory({
      name: translations.value.es.name,
      slug: translations.value.es.slug,
      description: translations.value.es.description || undefined,
    });

    toast.success("Categoría creada correctamente");
    router.push("/app/cms/blog/categories");
  } catch (e) {
    toast.error((e as any)?.message || "Error al guardar");
  }
};
</script>

<template>
  <div class="container mx-auto py-8 max-w-3xl">
    <!-- Header -->
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-3xl font-bold">{{ t("pages.blog.categories.create") }}</h1>
      <div class="flex items-center gap-4">
        <button type="button" class="btn btn-sm btn-outline" @click="toggleAll">
          {{ allOpen ? 'Colapsar todo' : 'Expandir todo' }}
        </button>
        <NuxtLink to="/app/cms/blog/categories" class="btn btn-ghost">
          {{ t("pages.common.cancel") }}
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
          open
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
                :label="t('pages.blog.categories.name')"
                required
                placeholder="en minúsculas, ej: mi-categoria"
                :error="lang.code === 'es' ? validationErrors.name : undefined"
              />

              <!-- Slug (only on default lang) -->
              <FormInput
                v-if="lang.code === 'es'"
                v-model="translations[lang.code].slug"
                label="Slug"
                placeholder="Se genera en minúsculas desde el nombre"
                required
                :error="validationErrors.slug"
                @focus="slugManuallyEdited = true"
              />

              <!-- Description -->
              <FormTextArea
                v-model="translations[lang.code].description"
                :label="t('pages.blog.categories.description')"
                :rows="3"
              />
            </div>
          </div>
        </details>
      </div>

      <div v-if="error" class="alert alert-error">
        {{ error }}
      </div>

      <div class="flex gap-4 pt-4">
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? t("pages.common.save") + "..." : t("pages.common.save") }}
        </button>
        <NuxtLink to="/app/cms/blog/categories" class="btn btn-ghost">
          {{ t("pages.common.cancel") }}
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
