<script setup lang="ts">
import FormInput from "@base/ui-app/components/form/FormInput.vue";
import FormTextArea from "@base/ui-app/components/form/FormTextArea.vue";
import FormMultipleSelect from "@base/ui-app/components/form/FormMultipleSelect.vue";

export interface SeoCardModel {
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string[];
  canonicalUrl: string;
  ogImageId: string | null;
  ogImageUrl: string | null;
  type?: "WebPage" | "Article" | "WebSite";
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
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    local.value = {
      ...local.value,
      ogImageId: result.id,
      ogImageUrl: result.url,
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
            @keyup.enter="addKeyword"
          />
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
            />
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
          />

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

        <div class="form-control">
          <label class="label">
            <span class="label-text font-semibold">
              {{ t("pages.seo.jsonLdType") || "JSON-LD Type" }}
            </span>
          </label>
          <select v-model="local.type" class="select select-bordered select-sm w-full">
            <option value="">{{ t("pages.seo.selectJsonLdType") || "Seleccionar tipo..." }}</option>
            <option value="WebPage">WebPage</option>
            <option value="Article">Article</option>
            <option value="WebSite">WebSite</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>
