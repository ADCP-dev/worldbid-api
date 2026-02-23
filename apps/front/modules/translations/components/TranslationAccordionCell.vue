<script setup lang="ts">
import { computed } from 'vue';
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { BotIcon } from 'lucide-vue-next'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { fetchWrapper } from '~/helpers/fetch-wrapper';
import { toast } from 'vue-sonner';

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
        toast.success(`Translation successful: ${response.message}`);
    } catch (error: any) {
        console.error('Failed to translate row', error);
        toast.error(`Translation failed: ${error.message || 'Unknown error'}`);
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
    toast.error('Failed to save translation');
  }
};

const summaryRows = computed(() => languageRows.value.filter(r => r.translation));
</script>

<template>
  <Accordion type="single" collapsible class="w-full">
    <AccordionItem :value="String(group.id)" class="border-b-0">
      <AccordionTrigger class="py-2 hover:no-underline text-left text-sm font-normal text-muted-foreground flex gap-2 overflow-hidden cursor-pointer">
        <template v-if="summaryRows.length > 0 && summaryRows[0]">
           <div class="flex gap-1 items-center truncate max-w-[200px]">
              <FlagIcon :code="summaryRows[0].lang.flagCode || summaryRows[0].lang.code" squared />
              <span class="truncate">{{ summaryRows[0].content }}</span>
           </div>
        </template>
        <template v-else>
            Sin traducciones
        </template>
      </AccordionTrigger>
      <AccordionContent>
        <div class="flex flex-col gap-4 pt-2 pb-4">
          <div class="flex justify-end mb-2">
            <Button @click="translateRow" :disabled="isTranslating" variant="outline" size="sm" class="flex gap-2 items-center">
                <BotIcon class="w-4 h-4"/>
                {{ isTranslating ? 'Traduciendo...' : 'Auto-Traducir faltantes (IA)' }}
            </Button>
          </div>
          <div v-for="row in languageRows" :key="row.lang.id" class="flex flex-col gap-1">
             <div class="flex gap-2 items-center text-xs font-semibold uppercase text-muted-foreground">
                <FlagIcon :code="row.lang.flagCode || row.lang.code" />
                <span>{{ row.lang.name }}</span>
             </div>
             <Textarea
              :model-value="row.content"
              :key="`${row.lang.id}-${row.content}`"
              class="min-h-[40px] w-full"
              :placeholder="`Traducción en ${row.lang.name}...`"
              @blur="handleBlur(row, $event)"
            />
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  </Accordion>
</template>
