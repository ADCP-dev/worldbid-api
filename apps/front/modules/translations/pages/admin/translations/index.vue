<script setup lang="ts">
import { useTranslations } from '../../../composables/useTranslations';
import { ref, onMounted, computed, h } from 'vue';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DataTable from '@/modules/ui-app/components/data-table/DataTable.vue';
import TranslationAccordionCell from '~/modules/translations/components/TranslationAccordionCell.vue';
import AddTranslationDialog from '~/modules/translations/components/AddTranslationDialog.vue';
import DeleteButton from '@/modules/ui-app/components/data-table/buttons/DeleteButton.vue';

const { getLangs, deleteTranslation, generateJson } = useTranslations();

const langs = ref<any[]>([]);
const activeLangs = computed(() => langs.value.filter(l => l.isActive));
// We will use Tabs to switch between Apps. Default is 'front'.
const currentAppTab = ref('front');

// Dynamic endpoints based on current tab. We append &app=front/back so the server filters it.
const endpointFront = computed(() => `translations?app=front`);
const endpointBack = computed(() => `translations?app=back`);

// To force reload DataTable when inline updates happen
const refreshKeyFront = ref(0);
const refreshKeyBack = ref(0);
const isGenerating = ref(false);

const fetchLangs = async () => {
  langs.value = await getLangs();
};

// Inline updating is now handled natively within TranslationAccordionCell.vue

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
    headerName: "Traducciones",
    header: "Traducciones",
    enableSorting: false,
    cell: ({ row }: any) => {
      const group = row.original;
      return h(TranslationAccordionCell, {
        group,
        langs: activeLangs.value,
        appContext: currentAppTab.value,
        onUpdate: (payload: any) => {
           // Re-fetch trigger
           if (currentAppTab.value === 'front') refreshKeyFront.value++;
           if (currentAppTab.value === 'back') refreshKeyBack.value++;
        }
      });
    }
  },
  {
    id: "actions",
    headerName: "Acciones",
    header: "Acciones",
    enableSorting: false,
    cell: ({ row }: any) => {
      const group = row.original;
      return h(DeleteButton, {
        onClick: async () => {
          if (confirm('Are you sure you want to delete this translation key across all languages?')) {
             try {
               await Promise.all(group.translations.map((t: any) => deleteTranslation(t.id)));
               if (currentAppTab.value === 'front') refreshKeyFront.value++;
               if (currentAppTab.value === 'back') refreshKeyBack.value++;
             } catch (error) {
               console.error(error);
               alert('Failed to delete translations.');
             }
          }
        }
      });
    }
  }
]);

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
});
</script>

<template>
  <div class="p-6">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">Translations</h1>
      <div class="flex gap-2">
        <AddTranslationDialog
          :appContext="currentAppTab"
          :langs="activeLangs"
          @created="refreshKeyFront++; refreshKeyBack++;"
        />
        <Button variant="outline" @click="handleGenerate" :disabled="isGenerating">
          {{ isGenerating ? 'Generating...' : 'Generate JSON' }}
        </Button>
      </div>
    </div>

    <!-- For a properly paginated backend, we skip manual client grouping and just filter by app -->
    <Tabs v-model="currentAppTab" class="w-full mt-4">
      <TabsList class="mb-4">
        <TabsTrigger value="front">Front App</TabsTrigger>
        <TabsTrigger value="back">Back App</TabsTrigger>
      </TabsList>

      <TabsContent value="front">
        <DataTable
          :columns="columns"
          :endpoint="endpointFront"
          :refreshKey="refreshKeyFront"
          tableName="translations-table-front"
        />
      </TabsContent>

      <TabsContent value="back">
        <DataTable
          :columns="columns"
          :endpoint="endpointBack"
          :refreshKey="refreshKeyBack"
          tableName="translations-table-back"
        />
      </TabsContent>
    </Tabs>
  </div>
</template>
