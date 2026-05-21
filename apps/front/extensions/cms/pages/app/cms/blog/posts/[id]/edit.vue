<script setup lang="ts">
import type { z } from "zod";
import { blogPostSchema } from "@cms/schemas/blog-post.schema";
import FormInput from "@base/ui-app/components/form/FormInput.vue";
import FormSelect from "@base/ui-app/components/form/FormSelect.vue";
import FormMultipleSelect from "@base/ui-app/components/form/FormMultipleSelect.vue";
import RichEditorAdvanced from "@cms/components/cms/RichEditorAdvanced.vue";
import CmsSeoCard, { type SeoCardModel } from "@cms/components/cms/CmsSeoCard.vue";
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
  fetchSeo,
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

const availableLangs = computed(() =>
  (locales.value as Array<{ code: string; name: string }>).map((l) => l.code),
);

const currentLang = ref((locales.value as Array<{ code: string }>)[0]?.code || 'es');

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
    lastPost = post;
    slugManuallyEdited.value = true;
    const trans = ((post as any).translations?.[currentLang.value] || {}) as Record<string, string>;
    form.value = {
      title: trans.title || "",
      slug: trans.slug || post.slug || "",
      content: trans.content || "",
      author: (post as any).author || "",
      categoryId: post.categoryId || "",
      tagIds: ((post as any).tagIds || post.tags?.map((t: any) => t.id)) || [],
      isPublished: post.isPublished || false,
      featuredImageId: post.featuredImage?.id || null,
    };

    if (post.featuredImage) {
      featuredImage.value = {
        id: post.featuredImage.id,
        url: post.featuredImage.url || `${useRuntimeConfig().public.apiUrl}${(post.featuredImage as any).path}`,
      };
    }

    // Load SEO data from dedicated endpoint
    try {
      const postSeo = await fetchSeo(postId, currentLang.value);
      if (postSeo) {
        seo.value = {
          metaTitle: postSeo.metaTitle || '',
          metaDescription: postSeo.metaDescription || '',
          metaKeywords: postSeo.metaKeywords || [],
          canonicalUrl: postSeo.canonicalUrl || '',
          ogImageId: postSeo.ogImageId || postSeo.ogImage?.id || null,
          ogImageUrl: postSeo.ogImage?.url || null,
          type: postSeo.type || 'Article',
          customJsonLd: postSeo.customJsonLd || null,
        };
      }
    } catch (_) { /* SEO fetch optional */ }
  } catch (e) {
    console.error(e);
  }
});

// Reload translations + SEO when language changes
let lastPost: any = null;
watch(currentLang, async (newLang) => {
  if (!lastPost) return;
  const trans = (lastPost.translations?.[newLang] || {}) as Record<string, string>;
  form.value.title = trans.title || '';
  form.value.slug = trans.slug || lastPost.slug || '';
  form.value.content = trans.content || '';
  // Reload SEO for new language
  try {
    const postSeo = await fetchSeo(postId, newLang);
    seo.value = {
      metaTitle: postSeo?.metaTitle || '',
      metaDescription: postSeo?.metaDescription || '',
      metaKeywords: postSeo?.metaKeywords || [],
      canonicalUrl: postSeo?.canonicalUrl || '',
      ogImageId: postSeo?.ogImageId || postSeo?.ogImage?.id || null,
      ogImageUrl: postSeo?.ogImage?.url || null,
      type: postSeo?.type || 'Article',
      customJsonLd: postSeo?.customJsonLd || null,
    };
  } catch (_) { /* optional */ }
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
      url: (result.url || result.featuredImage?.url)?.startsWith("/") ? `${useRuntimeConfig().public.apiUrl}${result.url || result.featuredImage?.url}` : (result.url || result.featuredImage?.url),
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

    // Save translations (title, content)
    const authStore = useAuthStore();
    const config = useRuntimeConfig();
    const baseUrl = `${config.public.apiUrl}${config.public.apiPrefix}`;
    await fetch(`${baseUrl}/translations/dynamic/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({
        entityName: 'BlogPost',
        entityId: postId,
        lang: currentLang.value,
        translations: [
          { section: 'default', key: 'title', value: form.value.title },
          { section: 'default', key: 'slug', value: form.value.slug },
          { section: 'default', key: 'content', value: form.value.content },
        ],
      }),
    });

    if (seo.value.metaTitle || seo.value.metaDescription) {
      await updateSeo(postId, seo.value, currentLang.value);
    }

    toast.success("Post actualizado correctamente");
    // Reload post data to reflect changes
    const updatedPost = await fetchPost(postId);
    lastPost = updatedPost;
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

      <!-- SEO (collapsible) -->
      <div class="collapse collapse-arrow bg-base-100 shadow-sm border">
        <input type="checkbox" >
        <div class="collapse-title text-lg font-medium">
          SEO
        </div>
        <div class="collapse-content">
          <CmsSeoCard
            v-model="seo"
            entity-type="BlogPost"
            :entity-id="postId"
          />
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
      <BlogPostPreview
        :visible="showPreviewModal"
        :title="form.title"
        :content="form.content"
        :post-id="postId"
        @close="showPreviewModal = false"
      />

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
