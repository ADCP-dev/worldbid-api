<script setup lang="ts">
import { useTranslations } from '../../../composables/useTranslations';
import { ref, onMounted, computed, h } from 'vue';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DataTable from '@/modules/ui-app/components/data-table/DataTable.vue';
import TranslationAccordionCell from '~/modules/translations/components/TranslationAccordionCell.vue';
import AddTranslationDialog from '~/modules/translations/components/AddTranslationDialog.vue';
import DeleteButton from '@/modules/ui-app/components/data-table/buttons/DeleteButton.vue';
import { toast } from 'vue-sonner';
import { BotIcon } from 'lucide-vue-next';

const { getLangs, deleteTranslation, generateJson, bulkTranslate } = useTranslations();

const langs = ref<any[]>([]);
const activeLangs = computed(() => langs.value.filter(l => l.isActive));
// We will use Tabs to switch between Apps. Default is 'front'.
const currentAppTab = ref('front');

// Dynamic endpoints based on current tab. We append &app=front/back so the server filters it.
const endpointFront = computed(() => `translations?app=front`);
const endpointBack = computed(() => `translations?app=back`);

// To force reload DataTable when inline updates happen
const frontTable = ref<any>(null);
const backTable = ref<any>(null);
const isGenerating = ref(false);
const isBulkTranslating = ref(false);

const fetchLangs = async () => {
  langs.value = await getLangs();
};

const refreshTables = () => {
  frontTable.value?.fetchData();
  backTable.value?.fetchData();
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
           refreshTables();
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
               refreshTables();
               toast.success('Translations deleted successfully.');
             } catch (error) {
               console.error(error);
               toast.error('Failed to delete translations.');
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
    toast.success('Generated successfully!');
  } catch (error) {
    console.error(error);
    toast.error('Failed to generate');
  } finally {
    isGenerating.value = false;
  }
};

const handleBulkTranslate = async () => {
  isBulkTranslating.value = true;
  try {
    const result = await bulkTranslate(currentAppTab.value);
    toast.success(result.message || 'Bulk translation completed');
    refreshTables();
  } catch (error: any) {
    console.error(error);
    toast.error(`Translation failed: ${error.message || 'Unknown error'}`);
  } finally {
    isBulkTranslating.value = false;
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
        <Button variant="outline" @click="handleBulkTranslate" :disabled="isBulkTranslating" class="flex gap-2 items-center">
          <BotIcon class="w-4 h-4" />
          {{ isBulkTranslating ? 'Traduciendo...' : 'Auto-Traducir Todo (IA)' }}
        </Button>
        <AddTranslationDialog
          :appContext="currentAppTab"
          :langs="activeLangs"
          @created="refreshTables"
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
          ref="frontTable"
          :columns="columns"
          :endpoint="endpointFront"
          tableName="translations-table-front"
        />
      </TabsContent>

      <TabsContent value="back">
        <DataTable
          ref="backTable"
          :columns="columns"
          :endpoint="endpointBack"
          tableName="translations-table-back"
        />
      </TabsContent>
    </Tabs>
  </div>
</template>
