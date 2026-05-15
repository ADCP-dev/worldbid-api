<script setup lang="ts">
import FormInput from "@base/ui-app/components/form/FormInput.vue";
import FormTextArea from "@base/ui-app/components/form/FormTextArea.vue";
import FormMultipleSelect from "@base/ui-app/components/form/FormMultipleSelect.vue";
import FormSelect from "@base/ui-app/components/form/FormSelect.vue";
import { fetchWrapper } from "@/helpers/fetch-wrapper";

export interface SeoCardModel {
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string[];
  canonicalUrl: string;
  ogImageId: string | null;
  ogImageUrl: string | null;
  type?: "WebPage" | "Article" | "WebSite" | "BlogPosting" | "Organization" | "Product" | "BreadcrumbList";
  customJsonLd?: Record<string, unknown> | null;
}

const props = defineProps<{
  modelValue: SeoCardModel;
  keywordOptions?: Array<{ value: string; label: string }>;
  entityType?: string;
  entityId?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: SeoCardModel): void;
}>();

const { t } = useI18n();

const runtimeConfig = useRuntimeConfig();
const baseUrl = `${runtimeConfig.public.apiUrl}${runtimeConfig.public.apiPrefix}`;

const local = computed<SeoCardModel>({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const newKeyword = ref("");
const isUploading = ref(false);
const uploadError = ref("");

const allKeywords = computed(() => {
  const existing = props.keywordOptions || [];
  const selected = local.value.metaKeywords.map((k) => ({
    value: k,
    label: k,
  }));
  const merged = [...existing];
  selected.forEach((s) => {
    if (!merged.find((m) => m.value === s.value)) {
      merged.push(s);
    }
  });
  return merged;
});

function addKeyword() {
  const kw = newKeyword.value.trim().toLowerCase();
  if (kw && !local.value.metaKeywords.includes(kw)) {
    local.value = {
      ...local.value,
      metaKeywords: [...local.value.metaKeywords, kw],
    };
  }
  newKeyword.value = "";
}

async function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  isUploading.value = true;
  uploadError.value = "";

  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("entityName", props.entityType || "Page");
    formData.append("entityId", props.entityId || "");
    formData.append("context", "og-image");

    const authStore = useAuthStore();
    const response = await fetch(`${baseUrl}/cms/media/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authStore.token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Upload failed (${response.status}): ${response.statusText}${body ? ' - ' + body : ''}`);
    }

    const result = await response.json();
    local.value = {
      ...local.value,
      ogImageId: result.id || result.file?.id,
      ogImageUrl: result.url || result.file?.url,
    };
  } catch (e) {
    uploadError.value = e instanceof Error ? e.message : "Error uploading image";
  } finally {
    isUploading.value = false;
    target.value = "";
  }
}

function removeImage() {
  local.value = {
    ...local.value,
    ogImageId: null,
    ogImageUrl: null,
  };
}

// --- JSON-LD ---

const jsonLdTypeOptions = computed(() => [
  { value: "", label: t("pages.seo.selectJsonLdType") || "None" },
  { value: "WebPage", label: "WebPage" },
  { value: "Article", label: "Article" },
  { value: "WebSite", label: "WebSite" },
  { value: "BlogPosting", label: "BlogPosting" },
  { value: "Organization", label: "Organization" },
  { value: "Product", label: "Product" },
  { value: "BreadcrumbList", label: "BreadcrumbList" },
]);

const jsonLdTemplate = ref<Record<string, unknown> | null>(null);
const isEditingJsonLd = ref(false);
const editJsonString = ref("");
const isFetchingTemplate = ref(false);
const templateFetchError = ref("");

watch(
  () => local.value.type,
  async (newType) => {
    jsonLdTemplate.value = null;
    templateFetchError.value = "";
    isEditingJsonLd.value = false;

    if (!newType) return;

    isFetchingTemplate.value = true;
    try {
      const result = await fetchWrapper.get(`${baseUrl}/cms/seo/template/${newType}`);
      jsonLdTemplate.value = result;
    } catch (e) {
      templateFetchError.value = e instanceof Error ? e.message : "Error fetching template";
    } finally {
      isFetchingTemplate.value = false;
    }
  },
);

const displayedJsonLd = computed(() => {
  const source = local.value.customJsonLd ?? jsonLdTemplate.value;
  if (!source) return "";
  return JSON.stringify(source, null, 2);
});

function startEditJsonLd() {
  editJsonString.value = displayedJsonLd.value;
  isEditingJsonLd.value = true;
}

function saveJsonLdEdit() {
  try {
    const parsed = JSON.parse(editJsonString.value);
    local.value = {
      ...local.value,
      customJsonLd: parsed,
    };
    isEditingJsonLd.value = false;
  } catch {
    // JSON parse error — keep editing
  }
}

function cancelJsonLdEdit() {
  isEditingJsonLd.value = false;
  editJsonString.value = "";
}
</script>

<template>
  <div class="card bg-base-100 shadow-sm border">
    <div class="card-body">
      <h3 class="card-title text-lg border-b pb-2 mb-4">
        {{ t("pages.seo.title") }}
      </h3>

      <div class="space-y-4">
        <FormInput
          v-model="local.metaTitle"
          :label="t('pages.seo.metaTitle')"
        />

        <FormTextArea
          v-model="local.metaDescription"
          :label="t('pages.seo.metaDescription')"
          :rows="2"
        />

        <FormMultipleSelect
          v-model="local.metaKeywords"
          :label="t('pages.seo.metaKeywords')"
          :options="allKeywords"
          :placeholder="t('pages.seo.selectKeywords') || 'Selecciona palabras clave...'"
        />

        <div class="flex gap-2">
          <input
            v-model="newKeyword"
            type="text"
            class="input input-sm input-bordered flex-1"
            :placeholder="t('pages.seo.newKeyword') || 'Nueva palabra clave...'"
            @keyup.enter.prevent="addKeyword"
          >
          <button
            type="button"
            class="btn btn-sm btn-outline"
            @click="addKeyword"
          >
            {{ t("pages.common.add") || "Agregar" }}
          </button>
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text font-semibold">
              {{ t("pages.seo.ogImage") }}
            </span>
          </label>

          <div v-if="local.ogImageUrl" class="mb-3 relative group">
            <img
              :src="local.ogImageUrl"
              class="h-24 w-full object-cover rounded-lg border"
              alt="OG Image"
            >
            <button
              type="button"
              class="absolute top-1 right-1 btn btn-xs btn-error btn-circle opacity-0 group-hover:opacity-100 transition-opacity"
              @click="removeImage"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <input
            type="file"
            accept="image/*"
            class="file-input file-input-bordered w-full file-input-sm"
            :disabled="isUploading"
            @change="handleImageUpload"
          >

          <span v-if="isUploading" class="text-sm text-base-content/60 mt-1">
            {{ t("pages.common.uploading") || "Subiendo..." }}
          </span>
          <span v-if="uploadError" class="text-sm text-error mt-1">
            {{ uploadError }}
          </span>
        </div>

        <FormInput
          v-model="local.canonicalUrl"
          :label="t('pages.seo.canonicalUrl')"
          placeholder="https://example.com/page"
        />

        <FormSelect
          v-model="local.type"
          :label="t('pages.seo.jsonLdType') || 'JSON-LD Type'"
          :options="jsonLdTypeOptions"
        />

        <!-- JSON-LD Preview -->
        <div v-if="local.type" class="form-control">
          <label class="label">
            <span class="label-text font-semibold">JSON-LD Preview</span>
          </label>

          <div v-if="isFetchingTemplate" class="skeleton h-32 w-full rounded-lg"/>

          <div v-else-if="templateFetchError" class="text-error text-sm">
            {{ templateFetchError }}
          </div>

          <div v-else class="space-y-2">
            <pre
              v-if="!isEditingJsonLd"
              class="bg-base-200 rounded-lg p-3 text-xs overflow-x-auto max-h-64"
            ><code>{{ displayedJsonLd }}</code></pre>

            <textarea
              v-else
              v-model="editJsonString"
              class="textarea textarea-bordered w-full font-mono text-xs"
              rows="8"
            />

            <div class="flex gap-2">
              <button
                v-if="!isEditingJsonLd"
                type="button"
                class="btn btn-xs btn-outline"
                @click="startEditJsonLd"
              >
                {{ t("pages.common.edit") || "Edit" }}
              </button>
              <template v-else>
                <button
                  type="button"
                  class="btn btn-xs btn-primary"
                  @click="saveJsonLdEdit"
                >
                  {{ t("pages.common.save") || "Save" }}
                </button>
                <button
                  type="button"
                  class="btn btn-xs btn-outline"
                  @click="cancelJsonLdEdit"
                >
                  {{ t("pages.common.cancel") || "Cancel" }}
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
