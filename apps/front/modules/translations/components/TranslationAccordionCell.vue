<script setup lang="ts">
import { ref, computed } from 'vue';
import { Textarea } from '@/components/ui/textarea'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const props = defineProps<{
  group: any;
  activeLangs: any[];
  appTab: string;
}>();

const emit = defineEmits(['update']);

// Fallback to 'es' language or the first available for preview
const esLang = computed(() => props.activeLangs.find(l => l.code === 'es') || props.activeLangs[0]);

const esTranslationPreview = computed(() => {
  if (!esLang.value) return 'No translations available';
  const content = props.group.items[esLang.value.id]?.content || '';
  if (!content) return '...';
  return content.length > 50 ? content.slice(0, 50) + '...' : content;
});

const handleBlur = (langId: number, event: Event) => {
  const content = (event.target as HTMLTextAreaElement).value;
  const existingTranslation = props.group.items[langId];
  emit('update', {
    appContext: props.appTab,
    section: props.group.section,
    key: props.group.key,
    langId,
    content,
    existingTranslation
  });
};

const getFlag = (code: string) => {
  switch (code.toLowerCase()) {
    case 'es': return '🇪🇸';
    case 'en': return '🇬🇧';
    case 'fr': return '🇫🇷';
    case 'de': return '🇩🇪';
    case 'it': return '🇮🇹';
    case 'pt': return '🇵🇹';
    case 'zh': return '🇨🇳';
    case 'ja': return '🇯🇵';
    default: return '🌐';
  }
};
</script>

<template>
  <Accordion type="single" collapsible class="w-full" as-child>
    <AccordionItem value="translation" class="border-b-0">
      <AccordionTrigger class="py-2 text-sm text-left truncate max-w-[200px] sm:max-w-[400px] font-normal" :title="esTranslationPreview">
        <span class="truncate block w-full">{{ esTranslationPreview }}</span>
      </AccordionTrigger>
      <AccordionContent class="pt-4 pb-4 space-y-4">
        <div v-for="lang in activeLangs" :key="lang.id" class="flex flex-col gap-2">
          <label class="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
            <span>{{ getFlag(lang.code) }}</span>
            <span>{{ lang.name }} ({{ lang.code }})</span>
          </label>
          <Textarea
            :default-value="group.items[lang.id]?.content || ''"
            @blur="(e) => handleBlur(lang.id, e)"
            :placeholder="`Enter translation for ${lang.name}...`"
            class="min-h-[60px]"
          />
        </div>
      </AccordionContent>
    </AccordionItem>
  </Accordion>
</template>
