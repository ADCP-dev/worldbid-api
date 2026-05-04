<script setup lang="ts">
import { z } from "zod";
import { blogPostSchema } from "@cms/schemas/blog-post.schema";
import FormInput from "@base/ui-app/components/form/FormInput.vue";
import FormSelect from "@base/ui-app/components/form/FormSelect.vue";
import FormMultipleSelect from "@base/ui-app/components/form/FormMultipleSelect.vue";
import RichEditorAdvanced from "@cms/components/cms/RichEditorAdvanced.vue";
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
const {
  fetchPost,
  updatePost,
  deletePost,
  loading,
  error,
  updateSeo,
  saveTranslationsBatch,
} = useCmsBlogPosts();
const { tags: availableTags, fetchTags } = useCmsTags();
const { categories, fetchCategories } = useCmsCategories();

const postId = route.params.id as string;

const showPreviewModal = ref(false);
const validationErrors = ref<Record<string, string>>({});

const form = ref({
  title: "",
  slug: "",
  content: "",
  author: "",
  categoryId: "",
  tagIds: [] as string[],
  isPublished: false,
  featuredImageId: null as string | null,
});

const featuredImage = ref<{ id: string; url: string } | null>(null);
const isUploadingCover = ref(false);
const previewImage = ref<string | null>(null);

const seo = ref<SeoCardModel>({
  metaTitle: "",
  metaDescription: "",
  metaKeywords: [],
  canonicalUrl: "",
  ogImageId: null,
  ogImageUrl: null,
  type: "Article",
});

const translations = ref<Record<string, Record<string, string>>>({});
const isSavingTranslations = ref(false);

const availableLangs = computed(() =>
  (locales.value as Array<{ code: string; name: string }>).map((l) => l.code),
);

const translationFields = ["title", "content", "slug"];

const tagOptions = computed(() =>
  availableTags.value.map((tag) => ({
    value: tag.id,
    label: tag.name,
  })),
);

const categoryOptions = computed(() =>
  categories.value.map((cat) => ({
    value: cat.id,
    label: cat.name,
  })),
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

const slugManuallyEdited = ref(false);

watch(
  () => form.value.title,
  (newVal) => {
    if (!slugManuallyEdited.value) {
      form.value.slug = kebabCase(newVal);
    }
  },
);

onMounted(async () => {
  try {
    await Promise.all([fetchTags(), fetchCategories()]);

    const post = await fetchPost(postId);
    form.value = {
      title: (post as any).title || "",
      slug: post.slug || "",
      content: (post as any).content || "",
      author: post.author || "",
      categoryId: post.categoryId || "",
      tagIds: post.tagIds || [],
      isPublished: post.isPublished || false,
      featuredImageId: post.featuredImage?.id || null,
    };

    if (post.featuredImage) {
      featuredImage.value = {
        id: post.featuredImage.id,
        url: post.featuredImage.url || `${useRuntimeConfig().public.apiUrl}${(post.featuredImage as any).path}`,
      };
    }

    // Load translations
    const transMap: Record<string, Record<string, string>> = {};
    for (const lang of availableLangs.value) {
      const langData = (post as any).translations?.[lang];
      transMap[lang] = {
        title: langData?.title || "",
        content: langData?.content || "",
        slug: langData?.slug || "",
      };
    }
    translations.value = transMap;

    // Load SEO data
    const postSeo = (post as any).seo;
    if (postSeo) {
      seo.value = {
        metaTitle: postSeo.metaTitle || "",
        metaDescription: postSeo.metaDescription || "",
        metaKeywords: postSeo.metaKeywords || [],
        canonicalUrl: postSeo.canonicalUrl || "",
        ogImageId: postSeo.ogImage?.id || null,
        ogImageUrl: postSeo.ogImage?.url || null,
        type: postSeo.type || "Article",
      };
    }
  } catch (e) {
    console.error(e);
  }
});

const handleCoverUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    previewImage.value = e.target?.result as string;
  };
  reader.readAsDataURL(file);

  isUploadingCover.value = true;

  try {
    const formData = new FormData();
    formData.append("file", file);

    const authStore = useAuthStore();
    const response = await fetch(
      `${useRuntimeConfig().public.apiUrl}/api/v1/cms/blog/posts/${postId}/featured-image`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authStore.token}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    featuredImage.value = {
      id: result.id || result.featuredImage?.id,
      url: result.url || result.featuredImage?.url,
    };
    previewImage.value = null;
  } catch (e) {
    console.error(e);
  } finally {
    isUploadingCover.value = false;
    target.value = "";
  }
};

const removeCover = () => {
  featuredImage.value = null;
  previewImage.value = null;
  form.value.featuredImageId = null;
};

function mapValidationErrors(zodError: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of zodError.issues) {
    const field = issue.path[0] as string;
    if (!errors[field]) errors[field] = issue.message;
  }
  return errors;
}

const handleSubmit = async () => {
  const dataToValidate = {
    title: form.value.title,
    slug: form.value.slug,
    content: form.value.content,
    categoryId: form.value.categoryId,
    tagIds: form.value.tagIds,
    isPublished: form.value.isPublished,
  };

  const result = blogPostSchema.safeParse(dataToValidate);
  if (!result.success) {
    validationErrors.value = mapValidationErrors(result.error);
    return;
  }

  validationErrors.value = {};

  try {
    await updatePost(postId, {
      slug: form.value.slug,
      author: form.value.author,
      categoryId: form.value.categoryId,
      tagIds: form.value.tagIds,
      isPublished: form.value.isPublished,
    });

    if (seo.value.metaTitle || seo.value.metaDescription) {
      await updateSeo(postId, seo.value, 'es');
    }

    await handleSaveTranslations();

    toast.success("Post actualizado correctamente");
    router.push("/app/cms/blog/posts");
  } catch (e) {
    toast.error((e as any)?.message || "Error al guardar");
  }
};

const handleDelete = async () => {
  if (!confirm("¿Estás seguro de eliminar esta entrada?")) return;
  try {
    await deletePost(postId);
    router.push("/app/cms/blog/posts");
  } catch (e) {
    console.error(e);
  }
};

const handleSaveTranslations = async () => {
  isSavingTranslations.value = true;
  try {
    for (const lang of availableLangs.value) {
      const langData = translations.value[lang] || {};
      const items = translationFields
        .map((key) => ({
          section: key,
          key,
          value: langData[key] || (form.value as Record<string, any>)[key] || '',
        }))
        .filter((item) => item.value.trim());
      if (items.length > 0) {
        await saveTranslationsBatch(postId, lang, items);
      }
    }
  } catch (e) {
    console.error("Error saving translations:", e);
  } finally {
    isSavingTranslations.value = false;
  }
};
</script>

<template>
  <div class="container mx-auto py-8 max-w-7xl">
    <!-- Header -->
    <div class="flex justify-between items-center mb-8">
      <div class="flex items-center gap-4">
        <NuxtLink to="/app/cms/blog/posts" class="btn btn-ghost btn-sm">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </NuxtLink>
        <h1 class="text-3xl font-bold">Editar post</h1>
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
      <!-- Title + Slug -->
      <div class="card bg-base-100 shadow-sm border">
        <div class="card-body">
          <h3 class="card-title text-lg border-b pb-2 mb-4">
            Título
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              v-model="form.title"
              label="Título"
              required
              placeholder="escribe en minúsculas, ej: mi-post"
            />
            <FormInput
              v-model="form.slug"
              label="Slug"
              required
              @focus="slugManuallyEdited = true"
            />
          </div>
        </div>
      </div>

      <!-- Cover Image -->
      <div class="card bg-base-100 shadow-sm border">
        <div class="card-body">
          <h3 class="card-title text-lg border-b pb-2 mb-4">
            Imagen destacada
          </h3>
          <div
            class="relative mb-3 rounded-lg overflow-hidden border-2 border-dashed border-base-300 bg-base-200"
            :class="featuredImage ? 'border-solid border-base-300' : 'h-48 flex items-center justify-center'"
          >
            <img
              v-if="featuredImage || previewImage"
              :src="previewImage || featuredImage?.url"
              class="w-full h-48 object-cover"
              alt="Cover"
            >
            <div v-else class="text-center p-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-2 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span class="text-base-content/60 text-sm">Selecciona una imagen de portada</span>
            </div>
            <button
              v-if="featuredImage || previewImage"
              type="button"
              class="absolute top-2 right-2 btn btn-xs btn-error btn-circle"
              @click="removeCover"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <input
            type="file"
            accept="image/*"
            class="file-input file-input-bordered w-full file-input-sm"
            :disabled="isUploadingCover"
            @change="handleCoverUpload"
          >
          <span v-if="isUploadingCover" class="text-sm text-base-content/60 mt-1 block">
            Subiendo...
          </span>
        </div>
      </div>

      <!-- Content + Details -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Content -->
        <div class="card bg-base-100 shadow-sm border lg:col-span-2">
          <div class="card-body">
            <div class="flex items-center justify-between border-b pb-2 mb-4">
              <h3 class="card-title text-lg">
                Contenido
              </h3>
              <button
                type="button"
                class="btn btn-sm btn-outline"
                @click="showPreviewModal = true"
              >
                Vista previa
              </button>
            </div>
            <RichEditorAdvanced
              v-model="form.content"
              entity-name="BlogPost"
              :entity-id="postId"
              class="min-h-[500px]"
            />
          </div>
        </div>

        <!-- Details -->
        <div class="card bg-base-100 shadow-sm border lg:col-span-1">
          <div class="card-body">
            <h3 class="card-title text-lg border-b pb-2 mb-4">
              Detalles
            </h3>
            <div class="grid grid-cols-1 gap-4">
              <FormSelect
                v-model="form.categoryId"
                label="Categoría"
                :options="categoryOptions"
                placeholder="Seleccionar categoría"
              />
              <FormMultipleSelect
                v-model="form.tagIds"
                label="Etiquetas"
                :options="tagOptions"
                placeholder="Seleccionar etiquetas"
              />
              <FormInput
                v-model="form.author"
                label="Autor"
                placeholder="Nombre del autor"
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
      </div>

      <!-- Preview Modal -->
      <div
        v-if="showPreviewModal"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-2"
        @click.self="showPreviewModal = false"
      >
        <div class="bg-base-100 w-full h-full flex flex-col rounded-lg overflow-hidden">
          <div class="flex justify-between items-center p-4 border-b">
            <h3 class="text-xl font-bold">
              Vista previa
            </h3>
            <button
              type="button"
              class="btn btn-sm btn-ghost"
              @click="showPreviewModal = false"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="flex-1 flex overflow-hidden">
            <div class="w-1/2 border-r overflow-hidden flex flex-col">
              <div class="bg-base-200 px-3 py-2 text-xs font-semibold text-base-content/60 uppercase tracking-wider">
                Fuente
              </div>
              <div class="flex-1 overflow-y-auto p-2">
                <RichEditorAdvanced
                  v-model="form.content"
                  entity-name="BlogPost"
                  :entity-id="postId"
                  class="min-h-full"
                />
              </div>
            </div>
            <div class="w-1/2 overflow-hidden flex flex-col bg-base-200">
              <div class="bg-base-200 px-3 py-2 text-xs font-semibold text-base-content/60 uppercase tracking-wider">
                Renderizado
              </div>
              <div class="flex-1 overflow-y-auto p-2">
                <div class="prose max-w-none bg-base-100 p-6 rounded-lg shadow-sm min-h-full">
                  <div v-if="form.title" class="mb-6">
                    <h1 class="text-3xl font-bold mb-4">{{ form.title }}</h1>
                  </div>
                  <div v-if="form.content" v-html="form.content"/>
                  <p v-else class="text-base-content/40 italic">El contenido aparecerá aquí...</p>
                </div>
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-2 px-4 py-2 border-t bg-base-100">
            <button type="button" class="btn btn-sm btn-ghost" @click="showPreviewModal = false">
              Cerrar
            </button>
          </div>
        </div>
      </div>

      <!-- SEO Card -->
      <CmsSeoCard
        v-model="seo"
        entity-type="BlogPost"
        :entity-id="postId"
      />

      <!-- Translations Table -->
      <div class="card bg-base-100 shadow-sm border">
        <div class="card-body">
          <h3 class="card-title text-lg border-b pb-2 mb-4">
            Traducciones
          </h3>
          <CmsEntityTranslationsTable
            :endpoint="`translations?filter[entityName]=BlogPost&filter[entityId]=${postId}`"
            table-name="blog-post-translations-table"
          />
        </div>
      </div>

      <div v-if="error" class="alert alert-error">
        {{ error }}
      </div>

      <!-- Save / Cancel buttons -->
      <div class="flex gap-4">
        <button
          type="submit"
          class="btn btn-primary"
          :disabled="loading"
        >
          {{ loading ? "..." : "Guardar" }}
        </button>
        <NuxtLink to="/app/cms/blog/posts" class="btn btn-ghost">
          Cancelar
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
