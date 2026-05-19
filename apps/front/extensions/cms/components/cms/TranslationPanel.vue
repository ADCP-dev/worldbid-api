<script setup lang="ts">
import { Sparkles, Check, AlertCircle } from "lucide-vue-next";

interface Props {
  entityId: string;
  entityName: "Page" | "BlogPost";
  fields: string[]; // ['title', 'content', 'excerpt']
  currentLang: string;
  availableLangs: string[];
  translations: Record<string, Record<string, string>>; // { es: { title: '...', content: '...' } }
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "translate", payload: { field: string; targetLang: string }): void;
  (e: "changeLang", lang: string): void;
}>();

// Calculate completeness per language
const completeness = computed<Record<string, number>>(() => {
  const result: Record<string, number> = {};
  const totalFields = props.fields.length;

  for (const lang of props.availableLangs) {
    const langTranslations = props.translations[lang] || {};
    const filledFields = props.fields.filter(
      (field) =>
        langTranslations[field] && langTranslations[field].trim() !== "",
    ).length;
    result[lang] =
      totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
  }

  return result;
});

// Get completeness status color
const getCompletenessColor = (percentage: number): string => {
  if (percentage >= 100) return "text-success";
  if (percentage >= 50) return "text-warning";
  return "text-error";
};

// Get completeness badge class
const getCompletenessBadge = (percentage: number): string => {
  if (percentage >= 100) return "badge-success";
  if (percentage >= 50) return "badge-warning";
  return "badge-error";
};

// Check if a field has translation
const hasTranslation = (field: string, lang: string): boolean => {
  const langTranslations = props.translations[lang] || {};
  return Boolean(
    langTranslations[field] && langTranslations[field].trim() !== "",
  );
};

// Track translating state per field
const translatingFields = ref<Set<string>>(new Set());

const isTranslating = (field: string) => translatingFields.value.has(field);

const handleTranslate = async (field: string, targetLang: string) => {
  translatingFields.value.add(field);
  try {
    emit("translate", { field, targetLang });
  } finally {
    // Clear after emit - parent should handle actual async and update translations
    setTimeout(() => {
      translatingFields.value.delete(field);
    }, 1000);
  }
};

// Language labels
const langLabels: Record<string, string> = {
  es: "Español",
  en: "English",
  pt: "Português",
  fr: "Français",
};

const getLangLabel = (lang: string) => langLabels[lang] || lang.toUpperCase();
</script>

<template>
  <div class="space-y-4">
    <!-- Language tabs with completeness -->
    <div class="tabs tabs-boxed bg-base-200 p-1">
      <button
        v-for="lang in availableLangs"
        :key="lang"
        type="button"
        class="tab gap-2"
        :class="{ 'tab-active': lang === currentLang }"
        @click="emit('changeLang', lang)"
      >
        <span>{{ getLangLabel(lang) }}</span>
        <span
          class="badge badge-xs"
          :class="getCompletenessBadge(completeness[lang] || 0)"
        >
          {{ completeness[lang] || 0 }}%
        </span>
      </button>
    </div>

    <!-- Field translation list -->
    <div class="space-y-3">
      <div v-for="field in fields" :key="field" class="form-control">
        <label class="label">
          <span class="label-text font-medium capitalize">{{ field }}</span>
          <span class="label-text-alt">
            <span
              v-if="hasTranslation(field, currentLang)"
              class="text-success flex items-center gap-1"
            >
              <Check class="w-3 h-3" />
              Translated
            </span>
            <span v-else class="text-warning flex items-center gap-1">
              <AlertCircle class="w-3 h-3" />
              Missing
            </span>
          </span>
        </label>

        <div class="flex gap-2">
          <!-- Show translated value if available -->
          <input
            type="text"
            class="input input-bordered flex-1"
            :value="translations[currentLang]?.[field] || ''"
            :placeholder="`Enter ${field} in ${getLangLabel(currentLang)}`"
            readonly
          >

          <!-- AI Translate button for missing translations -->
          <button
            v-for="targetLang in availableLangs.filter(
              (l) => l !== currentLang,
            )"
            :key="targetLang"
            type="button"
            class="btn btn-outline btn-sm gap-1"
            :disabled="
              isTranslating(field) || hasTranslation(field, targetLang)
            "
            @click="handleTranslate(field, targetLang)"
          >
            <Sparkles
              v-if="isTranslating(field)"
              class="w-4 h-4 animate-spin"
            />
            <Sparkles v-else class="w-4 h-4" />
            <span class="hidden sm:inline"
              >Translate to {{ getLangLabel(targetLang) }}</span
            >
          </button>
        </div>
      </div>
    </div>

    <!-- Overall completeness summary -->
    <div class="bg-base-200 rounded-lg p-4">
      <div class="flex items-center justify-between mb-2">
        <span class="font-medium">Translation Completeness</span>
        <span
          class="text-sm font-medium"
          :class="getCompletenessColor(completeness[currentLang] || 0)"
        >
          {{ completeness[currentLang] || 0 }}%
        </span>
      </div>
      <progress
        class="progress"
        :class="{
          'progress-success': (completeness[currentLang] || 0) >= 100,
          'progress-warning':
            (completeness[currentLang] || 0) >= 50 &&
            (completeness[currentLang] || 0) < 100,
          'progress-error': (completeness[currentLang] || 0) < 50,
        }"
        :value="completeness[currentLang] || 0"
        max="100"
      />
      <div class="flex justify-between text-xs text-base-content/60 mt-2">
        <span v-for="lang in availableLangs" :key="lang">
          {{ getLangLabel(lang) }}: {{ completeness[lang] || 0 }}%
        </span>
      </div>
    </div>
  </div>
</template>
