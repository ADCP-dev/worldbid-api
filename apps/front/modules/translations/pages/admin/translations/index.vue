<script setup lang="ts">
import { useTranslations } from '../../../composables/useTranslations';
import { ref, onMounted, computed, h } from 'vue';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DataTable from '@/modules/ui-app/components/data-table/DataTable.vue';
import TranslationAccordionCell from '~/modules/translations/components/TranslationAccordionCell.vue';

const { getLangs, getTranslations, createTranslation, updateTranslation, deleteTranslation, generateJson } = useTranslations();

const langs = ref<any[]>([]);
const activeLangs = computed(() => langs.value.filter(l => l.isActive));
const translations = ref<any[]>([]);
const isGenerating = ref(false);

// We will use Tabs to switch between Apps. Default is 'front'.
const currentAppTab = ref('front');

// Grouped state structure:
// groups.value[app][sectionKey] = { section, key, items: { [langId]: TranslationObject } }
const groupedTranslations = computed(() => {
  const groups: Record<string, Record<string, any>> = { front: {}, back: {} };

  translations.value.forEach(t => {
    // If translation has no specific app, it belongs to both tabs by default (or 'common')
    // We explicitly group them to make UI easy.
    const appsToGroup = t.app ? [t.app] : ['front', 'back'];

    appsToGroup.forEach(app => {
      if (!groups[app]) groups[app] = {};

      const groupKey = `${t.section}---${t.key}`;
      if (!groups[app][groupKey]) {
        groups[app][groupKey] = {
          section: t.section,
          key: t.key,
          items: {}
        };
      }

      groups[app][groupKey].items[t.lang.id] = t;
    });
  });

  return groups;
});

const frontData = computed(() => Object.values(groupedTranslations.value['front'] || {}));
const backData = computed(() => Object.values(groupedTranslations.value['back'] || {}));

const columns = computed(() => [
  {
    accessorKey: "section",
    headerName: "Sección",
    header: "Sección",
    filterType: "string"
  },
  {
    accessorKey: "key",
    headerName: "Clave",
    header: "Clave",
    filterType: "string"
  },
  {
    id: "content",
    headerName: "Contenido",
    header: "Contenido",
    enableSorting: false,
    cell: ({ row }: any) => {
      return h(TranslationAccordionCell, {
        group: row.original,
        activeLangs: activeLangs.value,
        appTab: currentAppTab.value,
        onUpdate: (payload: any) => {
           handleInlineUpdate(payload.appContext, payload.section, payload.key, payload.langId, payload.content, payload.existingTranslation);
        }
      });
    }
  }
]);

const fetchLangs = async () => {
  langs.value = await getLangs();
};

const fetchTranslations = async () => {
  translations.value = await getTranslations();
};

// Handle Blur event on inputs to trigger auto-save
const handleInlineUpdate = async (appContext: string, section: string, key: string, langId: number, content: string, existingTranslation: any) => {
  // Ignore empty strings if there is no existing translation
  if (!existingTranslation && !content.trim()) return;

  // If translation exists and content hasn't changed, ignore
  if (existingTranslation && existingTranslation.content === content) return;

  try {
    if (existingTranslation) {
      if (content.trim()) {
         await updateTranslation(existingTranslation.id, { content });
      } else {
         await deleteTranslation(existingTranslation.id);
      }
    } else {
      await createTranslation({
        langId,
        app: appContext,
        section,
        key,
        content
      });
    }
    // Refresh quietly
    await fetchTranslations();
  } catch (err) {
    console.error('Failed to inline update translation', err);
    alert('Failed to save translation');
  }
};

const handleGenerate = async () => {
  isGenerating.value = true;
  try {
    await generateJson();
    alert('Generated successfully!');
  } catch (error) {
    console.error(error);
    alert('Failed to generate');
  } finally {
    isGenerating.value = false;
  }
};


onMounted(async () => {
  await fetchLangs();
  await fetchTranslations();
});
</script>

<template>
  <div class="p-6">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">Translations</h1>
      <Button variant="outline" @click="handleGenerate" :disabled="isGenerating">
        {{ isGenerating ? 'Generating...' : 'Generate JSON' }}
      </Button>
    </div>

    <Tabs v-model="currentAppTab" class="w-full mt-4">
      <TabsList class="mb-4">
        <TabsTrigger value="front">Front App</TabsTrigger>
        <TabsTrigger value="back">Back App</TabsTrigger>
      </TabsList>

      <TabsContent value="front">
        <DataTable :columns="columns as any" :data="frontData" tableName="translations-table-front" />
      </TabsContent>

      <TabsContent value="back">
        <DataTable :columns="columns as any" :data="backData" tableName="translations-table-back" />
      </TabsContent>
    </Tabs>
  </div>
</template>
