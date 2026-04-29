<script setup lang="ts">
import FormInput from "@base/ui-app/components/form/FormInput.vue";
import FormTextArea from "@base/ui-app/components/form/FormTextArea.vue";

const { t } = useI18n();

export interface LanguageOption {
  code: string;
  label: string;
  flag: string;
}

export interface TranslationItemValue {
  title: string;
  slug: string;
  description: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
}

interface Props {
  languages: LanguageOption[];
  modelValue: Record<string, TranslationItemValue>;
  validationErrors: Record<string, Record<string, string>>;
  showMeta?: boolean;
  showContent?: boolean;
  showDescription?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showMeta: true,
  showContent: true,
  showDescription: true,
});

const emit = defineEmits<{
  (e: "update:modelValue", value: Record<string, TranslationItemValue>): void;
}>();

const activeLang = ref(props.languages[0]?.code || "es");

const translations = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

function ensureLang(lang: string): TranslationItemValue {
  if (!translations.value[lang]) {
    translations.value = {
      ...translations.value,
      [lang]: {
        title: "",
        slug: "",
        description: "",
        content: "",
        metaTitle: "",
        metaDescription: "",
      },
    };
  }
  return translations.value[lang];
}

function kebabCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function updateField(lang: string, field: keyof TranslationItemValue, value: string) {
  const current = ensureLang(lang);
  translations.value = {
    ...translations.value,
    [lang]: { ...current, [field]: value },
  };
}

// Auto-generate slug from title when slug is empty
watch(
  () => translations.value[activeLang.value]?.title,
  (newTitle, oldTitle) => {
    const current = ensureLang(activeLang.value);
    if (newTitle && !current.slug) {
      updateField(activeLang.value, "slug", kebabCase(newTitle));
    }
  },
);
</script>

<template>
  <div class="space-y-6">
    <!-- Language Tabs -->
    <div class="tabs tabs-boxed">
      <button
        v-for="lang in languages"
        :key="lang.code"
        type="button"
        class="tab"
        :class="{ 'tab-active': activeLang === lang.code }"
        @click="activeLang = lang.code"
      >
        <span class="mr-1">{{ lang.flag }}</span>
        {{ lang.label }}
        <span
          v-if="validationErrors[lang.code] && Object.keys(validationErrors[lang.code]).length > 0"
          class="badge badge-error badge-xs ml-1"
        >
          {{ Object.keys(validationErrors[lang.code]).length }}
        </span>
      </button>
    </div>

    <!-- Fields for active language -->
    <div
      v-for="lang in languages"
      :key="lang.code"
      v-show="activeLang === lang.code"
      class="space-y-4"
    >
      <!-- Title -->
      <FormInput
        :model-value="ensureLang(lang.code).title"
        :label="t('pages.common.title') || 'Título'"
        required
        :placeholder="t('pages.blog.posts.titlePlaceholder') || 'Título en ' + lang.label"
        :error="validationErrors[lang.code]?.title"
        @update:model-value="updateField(lang.code, 'title', $event)"
      />

      <!-- Slug -->
      <FormInput
        :model-value="ensureLang(lang.code).slug"
        :label="t('pages.blog.posts.slug') || 'Slug'"
        required
        :description="`URL: /blog/${ensureLang(lang.code).slug || 'slug'}`"
        :error="validationErrors[lang.code]?.slug"
        @update:model-value="updateField(lang.code, 'slug', $event)"
      />

      <!-- Description -->
      <FormTextArea
        v-if="showDescription"
        :model-value="ensureLang(lang.code).description"
        :label="t('pages.common.description') || 'Descripción'"
        :placeholder="t('pages.blog.posts.descriptionPlaceholder') || 'Descripción en ' + lang.label"
        :error="validationErrors[lang.code]?.description"
        @update:model-value="updateField(lang.code, 'description', $event)"
      />

      <!-- Content -->
      <div v-if="showContent">
        <label class="label-text font-semibold mb-2 block">
          {{ t("pages.blog.posts.content") || "Contenido" }}
        </label>
        <RichEditorAdvanced
          :model-value="ensureLang(lang.code).content"
          @update:model-value="updateField(lang.code, 'content', $event)"
          class="min-h-[400px]"
        />
        <label v-if="validationErrors[lang.code]?.content" class="label py-0 mt-1">
          <span class="label-text-alt text-error font-medium">{{ validationErrors[lang.code]?.content }}</span>
        </label>
      </div>

      <!-- Meta fields -->
      <div v-if="showMeta" class="card bg-base-100 border p-4 space-y-4">
        <h4 class="font-semibold text-sm text-base-content/70">
          {{ t("pages.common.seoMeta") || "SEO Meta" }}
        </h4>

        <FormInput
          :model-value="ensureLang(lang.code).metaTitle"
          :label="t('pages.seo.metaTitle') || 'Meta Título'"
          :placeholder="t('pages.seo.metaTitlePlaceholder') || 'Meta título en ' + lang.label"
          :error="validationErrors[lang.code]?.metaTitle"
          @update:model-value="updateField(lang.code, 'metaTitle', $event)"
        />

        <FormTextArea
          :model-value="ensureLang(lang.code).metaDescription"
          :label="t('pages.seo.metaDescription') || 'Meta Descripción'"
          :placeholder="t('pages.seo.metaDescriptionPlaceholder') || 'Meta descripción en ' + lang.label"
          :error="validationErrors[lang.code]?.metaDescription"
          @update:model-value="updateField(lang.code, 'metaDescription', $event)"
        />
      </div>
    </div>
  </div>
</template>
