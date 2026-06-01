<script setup lang="ts">
import { computed, ref } from 'vue';
import { BotIcon, Loader2 } from 'lucide-vue-next'
import { fetchWrapper } from '~/helpers/fetch-wrapper';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const { createTranslation, updateTranslation, deleteTranslation } = useTranslations();

const props = defineProps<{
  group: any;
  langs: any[];
  appContext: string;
}>();

const emit = defineEmits(['update']);

const isTranslating = ref(false);

const getBaseUrl = () => {
  const runtimeConfig = useRuntimeConfig();
  return `${runtimeConfig.public.apiUrl}${runtimeConfig.public.apiPrefix}`;
};

const translateRow = async () => {
    isTranslating.value = true;
    const baseUrl = getBaseUrl();
    try {
        const response = await fetchWrapper.post(`${baseUrl}/translations/translate-row`, {
            app: props.appContext || 'front',
            section: props.group.section,
            key: props.group.key
        });

        // Tell parent to refresh
        emit('update', 'Translated via AI');
        toast.success(`${t('base.translations.accordion.toast.success')}: ${response.message}`);
    } catch (error: any) {
        console.error('Failed to translate row', error);
        toast.error(`${t('base.translations.accordion.toast.error')}: ${error.message || 'Unknown error'}`);
    } finally {
        isTranslating.value = false;
    }
};

// Map available langs to the translations that exist in this group
const languageRows = computed(() => {
  return props.langs.map(l => {
    const existing = props.group.translations?.find((t: any) => t.lang.id === l.id);
    return {
      lang: l,
      translation: existing,
      content: existing?.content || ''
    };
  });
});

const handleBlur = async (row: any, event: Event) => {
  const newContent = (event.target as HTMLTextAreaElement).value.trim();
  const existingTranslation = row.translation;

  if (!existingTranslation && !newContent) return; // Nothing to do
  if (existingTranslation && existingTranslation.content === newContent) return; // No change

  try {
    if (existingTranslation) {
      if (newContent) {
         await updateTranslation(existingTranslation.id, { content: newContent });
      } else {
         await deleteTranslation(existingTranslation.id);
      }
    } else {
      await createTranslation({
        langId: row.lang.id,
        app: props.appContext || 'common',
        section: props.group.section,
        key: props.group.key,
        content: newContent
      });
    }
    // Tell parent to refresh
    emit('update', newContent);
  } catch (err) {
    console.error('Failed to update translation', err);
    toast.error(t('base.translations.accordion.toast.saveError'));
  }
};

const summaryRows = computed(() => languageRows.value.filter(r => r.translation));
</script>

<template>
  <div class="collapse collapse-arrow bg-base-100 border  w-full rounded-md shadow-sm">
    <input type="checkbox" >
    <div class="collapse-title py-2 px-4 hover:bg-base-200/50 text-left text-sm font-normal text-muted-foreground flex gap-2 items-center overflow-hidden cursor-pointer min-h-0">
      <template v-if="summaryRows.length > 0 && summaryRows[0]">
         <div class="flex gap-2 items-center truncate max-w-[200px]">
            <span :class="['fi', 'fi-' + (summaryRows[0].lang.flagCode || summaryRows[0].lang.code)]" style="width: 1.2em; height: 1.2em; display: inline-block;" />
            <span class="truncate text-base-content">{{ summaryRows[0].content }}</span>
         </div>
      </template>
      <template v-else>
          <span class="italic opacity-50">{{ $t('base.translations.accordion.noTranslations') }}</span>
      </template>
    </div>
    <div class="collapse-content bg-base-200/20 px-4">
      <div class="flex flex-col sm:flex-row gap-4">
        <div class="flex items-center justify-center">
          <div class="tooltip tooltip-right" :data-tip="$t('base.translations.accordion.tooltip')">
            <button
              class="btn btn-outline btn-square btn-sm"
              :disabled="isTranslating"
              @click="translateRow"
            >
              <BotIcon v-if="!isTranslating" class="w-4 h-4"/>
              <Loader2 v-if="isTranslating" class="w-4 h-4 animate-spin"/>
            </button>
          </div>
        </div>

        <div class="flex-grow space-y-4">
          <div v-for="row in languageRows" :key="row.lang.id" class="form-control w-full">
            <label class="label py-1">
              <span class="label-text-alt uppercase font-bold flex gap-2 items-center text-base-content/70">
                <span :class="['fi', 'fi-' + (row.lang.flagCode || row.lang.code)]" style="width: 1em; height: 1em; display: inline-block;" />
                {{ row.lang.name }}
              </span>
            </label>
            <textarea
              :key="`${row.lang.id}-${row.content}`"
              class="textarea textarea-bordered textarea-sm w-full min-h-[60px]"
              :value="row.content"
              :placeholder="$t('base.translations.accordion.placeholder', { lang: row.lang.name })"
              @blur="handleBlur(row, $event)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
