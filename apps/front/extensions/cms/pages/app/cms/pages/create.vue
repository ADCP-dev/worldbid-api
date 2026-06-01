<script setup lang="ts">
import type { z } from "zod";
import { pageSchema } from "@cms/schemas/page.schema";
import FormTextArea from "@base/ui-app/components/form/FormTextArea.vue";
import CmsSeoCard, { type SeoCardModel } from "@cms/components/cms/CmsSeoCard.vue";
import { toast } from "vue-sonner";

definePageMeta({
  layout: "default",
  middleware: "auth",
});

const { t } = useI18n();
const router = useRouter();
const { createPage, loading, error, updateSeo, saveTranslation } = useCmsPages();

const isCreating = ref(false);
const formError = ref<string | null>(null);
const validationErrors = ref<Record<string, string>>({});
const slugManuallyEdited = false;

const form = ref({
  name: "",
  slug: "",
  description: "",
  section: "blog" as "landing" | "blog" | "documentation" | "store",
  isPublished: false,
});

const sections = [
  { value: "landing", label: "Landing" },
  { value: "blog", label: "Blog" },
  { value: "documentation", label: "Documentation" },
  { value: "store", label: "Store" },
];

function kebabCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function mapValidationErrors(zodError: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of zodError.issues) {
    const field = issue.path[0] as string;
    if (!errors[field]) errors[field] = issue.message;
  }
  return errors;
}

watch(
  () => form.value.name,
  (newVal) => {
    if (!slugManuallyEdited || !form.value.slug) {
      form.value.slug = '/' + kebabCase(newVal);
    }
  },
);

const seo = ref<SeoCardModel>({
  metaTitle: "",
  metaDescription: "",
  metaKeywords: [],
  canonicalUrl: "",
  ogImageId: null,
  ogImageUrl: null,
  type: "WebPage",
});

const handleSubmit = async () => {
  if (isCreating.value) return;

  const dataToValidate = {
    name: form.value.name,
    slug: form.value.slug,
    section: form.value.section,
    isPublished: form.value.isPublished,
  };

  const result = pageSchema.safeParse(dataToValidate);
  if (!result.success) {
    validationErrors.value = mapValidationErrors(result.error);
    return;
  }

  validationErrors.value = {};
  isCreating.value = true;
  formError.value = null;

  try {
    const page = await createPage({
      name: form.value.name,
      slug: form.value.slug,
      section: form.value.section,
      isPublished: form.value.isPublished,
    });

    if (seo.value.metaTitle || seo.value.metaDescription) {
      await updateSeo(page.id, seo.value, 'es');
    }

    if (form.value.description) {
      await saveTranslation(
        `page.${page.name}`,
        'es',
        'description',
        form.value.description,
      );
    }

    toast.success("Página creada correctamente");
    router.push(`/app/cms/pages/${page.id}/edit`);
  } catch (e) {
    toast.error((e as any)?.message || "Error al guardar");
    isCreating.value = false;
  }
};
</script>

<template>
  <div class="container mx-auto py-8 max-w-7xl">
    <!-- Header -->
    <div class="flex justify-between items-start mb-8">
      <div class="flex items-center gap-4">
        <NuxtLink to="/app/cms/pages" class="btn btn-ghost btn-sm">
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
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </NuxtLink>
        <h1 class="text-3xl font-bold">Crear página</h1>
      </div>
      <div class="flex items-center gap-3">
        <FormSelect
          v-model="form.section"
          label="Sección"
          :options="sections"
        />
        <label class="label cursor-pointer gap-2 whitespace-nowrap">
          <input
            v-model="form.isPublished"
            type="checkbox"
            class="toggle toggle-primary toggle-sm"
          >
          <span class="label-text">{{ form.isPublished ? "Publicado" : "Borrador" }}</span>
        </label>
        <NuxtLink to="/app/cms/pages" class="btn btn-ghost">Cancelar</NuxtLink>
      </div>
    </div>

    <form class="space-y-6" @submit.prevent="handleSubmit">
      <!-- Name + Slug + Description Card -->
      <div class="card bg-base-100 shadow-sm border">
        <div class="card-body">
          <h3 class="card-title text-lg border-b pb-2 mb-4">Nombre</h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              v-model="form.name"
              label="Nombre"
              required
              placeholder="ej: HomePage o BlogHome"
              :error="validationErrors.name"
            />

            <FormInput
              v-model="form.slug"
              label="Slug"
              required
              :error="validationErrors.slug"
              @focus="slugManuallyEdited = true"
            />
          </div>

          <FormTextArea
            v-model="form.description"
            label="Descripción"
            :rows="4"
            class="mt-4"
          />
        </div>
      </div>

      <!-- SEO Card -->
      <CmsSeoCard v-model="seo" entity-type="Page" />

      <!-- Translations Table -->
      <div class="card bg-base-100 shadow-sm border">
        <div class="card-body">
          <h3 class="card-title text-lg border-b pb-2 mb-4">Traducciones</h3>
          <p class="text-sm text-base-content/60 mb-4">
            Las traducciones se podrán gestionar después de guardar la página.
          </p>
        </div>
      </div>

      <div v-if="formError" class="alert alert-error">
        {{ formError }}
      </div>

      <div v-if="error" class="alert alert-error">
        {{ error }}
      </div>

      <div class="flex gap-4">
        <button
          type="submit"
          class="btn btn-primary"
          :disabled="loading || isCreating"
        >
          {{ loading ? "Guardando..." : "Guardar" }}
        </button>
        <NuxtLink to="/app/cms/pages" class="btn btn-ghost">Cancelar</NuxtLink>
      </div>
    </form>
  </div>
</template>
