<script setup lang="ts">
import JsonLdEditor from '@cms/components/cms/JsonLdEditor.vue';
import FormInput from "@base/ui-app/components/form/FormInput.vue";
import FormTextArea from "@base/ui-app/components/form/FormTextArea.vue";
import FormMultipleSelect from "@base/ui-app/components/form/FormMultipleSelect.vue";
import FormSelect from "@base/ui-app/components/form/FormSelect.vue";
import { useApi } from '#imports'

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
  { value: "", label: t("mod.pages.seo.selectJsonLdType") || "None" },
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
      const result = await useApi().get(`/cms/seo/template/${newType}`);
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
        {{ t("mod.pages.seo.title") }}
      </h3>

      <div class="space-y-4">
        <FormInput
          v-model="local.metaTitle"
          :label="t('mod.pages.seo.metaTitle')"
        />

        <FormTextArea
          v-model="local.metaDescription"
          :label="t('mod.pages.seo.metaDescription')"
          :rows="2"
        />

        <FormMultipleSelect
          v-model="local.metaKeywords"
          :label="t('mod.pages.seo.metaKeywords')"
          :options="allKeywords"
          :placeholder="t('mod.pages.seo.selectKeywords') || 'Selecciona palabras clave...'"
        />

        <div class="flex gap-2">
          <input
            v-model="newKeyword"
            type="text"
            class="input input-sm input-bordered flex-1"
            :placeholder="t('mod.pages.seo.newKeyword') || 'Nueva palabra clave...'"
            @keyup.enter.prevent="addKeyword"
          >
          <button
            type="button"
            class="btn btn-sm btn-outline"
            @click="addKeyword"
          >
            {{ t("mod.pages.common.add") || "Agregar" }}
          </button>
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text font-semibold">
              {{ t("mod.pages.seo.ogImage") }}
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
            {{ t("mod.pages.common.uploading") || "Subiendo..." }}
          </span>
          <span v-if="uploadError" class="text-sm text-error mt-1">
            {{ uploadError }}
          </span>
        </div>

        <FormInput
          v-model="local.canonicalUrl"
          :label="t('mod.pages.seo.canonicalUrl')"
          placeholder="https://example.com/page"
        />

        <FormSelect
          v-model="local.type"
          :label="t('mod.pages.seo.jsonLdType') || 'JSON-LD Type'"
          :options="jsonLdTypeOptions"
        />

        <!-- JSON-LD Editor -->
        <div v-if="local.type" class="form-control">
          <label class="label">
            <span class="label-text font-semibold">JSON-LD</span>
          </label>
          <JsonLdEditor v-model="jsonLdString" />
        </div>
      </div>
    </div>
  </div>
</template>
