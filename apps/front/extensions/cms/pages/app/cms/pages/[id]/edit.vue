<script setup lang="ts">
import type { z } from "zod";
import { pageSchema } from "@cms/schemas/page.schema";
import CmsSeoCard, { type SeoCardModel } from "@cms/components/cms/CmsSeoCard.vue";
import CmsEntityTranslationsTable from "@cms/components/cms/CmsEntityTranslationsTable.vue";
import { toast } from "vue-sonner";

definePageMeta({
  layout: "default",
  middleware: "auth",
});

const { locale, locales } = useI18n();
const router = useRouter();
const route = useRoute();
const { fetchPage, updatePage, deletePage, loading, updateSeo, fetchSeo } = useCmsPages();

const availableLangs = computed(() =>
  (locales.value as Array<{ code: string }>).map((l) => l.code),
);
const currentLang = ref((locales.value as Array<{ code: string }>)[0]?.code || 'es');

const pageId = route.params.id as string;
let lastPage: any = null;

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

const slugManuallyEdited = ref(false);

watch(
  () => form.value.name,
  (newName) => {
    if (!slugManuallyEdited.value) {
      form.value.slug = kebabCase(newName);
    }
  },
);

onMounted(async () => {
  try {
    const page = await fetchPage(pageId);
    lastPage = page;

    form.value = {
      name: page.name || "",
      slug: page.slug,
      description: (page as any).description || "",
      section: (page.section || "blog") as "landing" | "blog" | "documentation" | "store",
      isPublished: page.isPublished || false,
    };

    // Load SEO data from dedicated endpoint
    try {
      const pageSeo = await fetchSeo(pageId, currentLang.value);
      if (pageSeo) {
        seo.value = {
          metaTitle: pageSeo.metaTitle || '',
          metaDescription: pageSeo.metaDescription || '',
          metaKeywords: pageSeo.metaKeywords || [],
          canonicalUrl: pageSeo.canonicalUrl || '',
          ogImageId: pageSeo.ogImageId || pageSeo.ogImage?.id || null,
          ogImageUrl: pageSeo.ogImage?.url || null,
          type: pageSeo.type || 'WebPage',
          customJsonLd: pageSeo.customJsonLd || null,
        };
      }
    } catch (_) { /* SEO fetch optional */ }
  } catch (e) {
    console.error(e);
  }
});

// Reload SEO when language changes
watch(currentLang, async (newLang) => {
  try {
    const pageSeo = await fetchSeo(pageId, newLang);
    seo.value = {
      metaTitle: pageSeo?.metaTitle || '',
      metaDescription: pageSeo?.metaDescription || '',
      metaKeywords: pageSeo?.metaKeywords || [],
      canonicalUrl: pageSeo?.canonicalUrl || '',
      ogImageId: pageSeo?.ogImageId || pageSeo?.ogImage?.id || null,
      ogImageUrl: pageSeo?.ogImage?.url || null,
      type: pageSeo?.type || 'WebPage',
      customJsonLd: pageSeo?.customJsonLd || null,
    };
  } catch (_) { /* optional */ }
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

    if (seo.value.metaTitle || seo.value.metaDescription) {
      await updateSeo(pageId, seo.value, currentLang.value);
    }

    toast.success("Página actualizada correctamente");
    const updatedPage = await fetchPage(pageId);
    lastPage = updatedPage;
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

    <form class="space-y-6" @submit.prevent="handleSubmit">
      <!-- Language Selector -->
      <div class="card bg-base-100 shadow-sm border">
        <div class="card-body py-3">
          <div class="flex items-center gap-3">
            <span class="text-sm font-medium">Idioma:</span>
            <select v-model="currentLang" class="select select-bordered select-sm">
              <option v-for="lang in availableLangs" :key="lang" :value="lang">
                {{ lang.toUpperCase() }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <!-- Name + Slug + Author Card -->
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
              @blur="slugManuallyEdited = true"
            />
          </div>
        </div>
      </div>

      <!-- Description — internal note only, not translatable -->
      <div class="card bg-base-100 shadow-sm border">
        <div class="card-body">
          <div class="form-control">
            <label class="label">
              <span class="label-text text-xs text-base-content/60">Descripción interna</span>
            </label>
            <textarea
              v-model="form.description"
              class="textarea textarea-bordered text-sm h-16"
              placeholder="Nota interna, no visible en el sitio"
            />
          </div>
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
                  v-model="form.isPublished"
                  type="checkbox"
                  class="toggle toggle-primary"
                >
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
