<script setup lang="ts">
import { z } from "zod";
import { pageSchema } from "@cms/schemas/page.schema";
import FormTextArea from "@base/ui-app/components/form/FormTextArea.vue";
import CmsSeoCard, { type SeoCardModel } from "@cms/components/cms/CmsSeoCard.vue";
import CmsEntityTranslationsTable from "@cms/components/cms/CmsEntityTranslationsTable.vue";
import { toast } from "vue-sonner";

definePageMeta({
  layout: "default",
  middleware: "auth",
});

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const { fetchPage, updatePage, deletePage, loading } = useCmsPages();

const pageId = route.params.id as string;

const seo = ref<SeoCardModel>({
  metaTitle: "",
  metaDescription: "",
  metaKeywords: [],
  canonicalUrl: "",
  ogImageId: null,
  ogImageUrl: null,
  type: "WebPage",
});

const form = ref({
  name: "",
  slug: "",
  description: "",
  section: "blog" as "landing" | "blog" | "documentation" | "store",
  isPublished: false,
});

const validationErrors = ref<Record<string, string>>({});

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

let slugManuallyEdited = false;

watch(
  () => form.value.name,
  (newName) => {
    if (!slugManuallyEdited) {
      form.value.slug = kebabCase(newName);
    }
  },
);

onMounted(async () => {
  try {
    const page = await fetchPage(pageId);

    form.value = {
      name: page.name || "",
      slug: page.slug,
      description: (page as any).description || "",
      section: (page.section || "blog") as "landing" | "blog" | "documentation" | "store",
      isPublished: page.isPublished || false,
    };

    // Load SEO data
    const pageSeo = (page as any).seo;
    if (pageSeo) {
      seo.value = {
        metaTitle: pageSeo.metaTitle || "",
        metaDescription: pageSeo.metaDescription || "",
        metaKeywords: pageSeo.metaKeywords || [],
        canonicalUrl: pageSeo.canonicalUrl || "",
        ogImageId: pageSeo.ogImage?.id || null,
        ogImageUrl: pageSeo.ogImage?.url || null,
        type: "WebPage",
      };
    }
  } catch (e) {
    console.error(e);
  }
});

const handleSubmit = async () => {
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

  try {
    await updatePage(pageId, {
      name: form.value.name,
      slug: form.value.slug,
      section: form.value.section,
      isPublished: form.value.isPublished,
    });

    toast.success("Página actualizada correctamente");
    router.push("/app/cms/pages");
  } catch (e) {
    toast.error((e as any)?.message || "Error al guardar");
  }
};

const handleDelete = async () => {
  if (!confirm("¿Estás seguro de eliminar esta página?")) return;
  try {
    await deletePage(pageId);
    router.push("/app/cms/pages");
  } catch (e) {
    console.error(e);
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
        <h1 class="text-3xl font-bold">Editar página</h1>
      </div>
      <div class="flex items-center gap-3">
        <button type="button" class="btn btn-error btn-outline" @click="handleDelete">
          Eliminar
        </button>
        <button type="submit" class="btn btn-primary" :disabled="loading" @click="handleSubmit">
          {{ loading ? "..." : "Guardar" }}
        </button>
      </div>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Name + Slug + Author Card -->
      <div class="card bg-base-100 shadow-sm border">
        <div class="card-body">
          <h3 class="card-title text-lg border-b pb-2 mb-4">Nombre</h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              v-model="form.name"
              label="Nombre"
              required
              placeholder="escribe en minúsculas, ej: mi-pagina"
              :error="validationErrors.name"
            />

            <FormInput
              v-model="form.slug"
              label="Slug"
              required
              :error="validationErrors.slug"
              @blur="slugManuallyEdited = true"
            />
          </div>
        </div>
      </div>

      <!-- Description Card -->
      <div class="card bg-base-100 shadow-sm border">
        <div class="card-body">
          <h3 class="card-title text-lg border-b pb-2 mb-4">Descripción</h3>
          <FormTextArea
            v-model="form.description"
            label="Descripción"
            :rows="4"
          />
        </div>
      </div>

      <!-- Section + Status -->
      <div class="card bg-base-100 shadow-sm border">
        <div class="card-body">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect
              v-model="form.section"
              label="Sección"
              :options="sections"
            />

            <div class="form-control">
              <label class="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  v-model="form.isPublished"
                />
                <span class="label-text">{{ form.isPublished ? "Publicado" : "Borrador" }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- SEO Card -->
      <CmsSeoCard v-model="seo" entity-type="Page" :entity-id="pageId" />

      <!-- Translations Table -->
      <div class="card bg-base-100 shadow-sm border">
        <div class="card-body">
          <h3 class="card-title text-lg border-b pb-2 mb-4">Traducciones</h3>
          <CmsEntityTranslationsTable
            :endpoint="`translations?filter[category]=page.${encodeURIComponent(form.name)}`"
            table-name="page-translations-table"
          />
        </div>
      </div>

      <div v-if="error" class="alert alert-error">
        {{ error }}
      </div>

      <div class="flex gap-4">
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? "..." : "Guardar" }}
        </button>
        <NuxtLink to="/app/cms/pages" class="btn btn-ghost">Cancelar</NuxtLink>
      </div>
    </form>
  </div>
</template>
