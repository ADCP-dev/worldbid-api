<script setup lang="ts">
import { useTranslations } from '../../../composables/useTranslations';
import { ref, onMounted, computed, h } from 'vue';
import DataTable from '@/modules/ui-app/components/data-table/DataTable.vue';
import TranslationAccordionCell from '~/modules/translations/components/TranslationAccordionCell.vue';
import AddTranslationDialog from '~/modules/translations/components/AddTranslationDialog.vue';
import DeleteButton from '@/modules/ui-app/components/data-table/buttons/DeleteButton.vue';
import { toast } from 'vue-sonner';
import { BotIcon, LayersIcon, PanelTopIcon } from 'lucide-vue-next';

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
  <div class="p-1 md:p-6">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
      <h1 class="text-2xl font-bold">Translations</h1>
      <div class="flex flex-wrap gap-2">
        <button class="btn btn-outline" @click="handleBulkTranslate" :disabled="isBulkTranslating">
          <BotIcon class="w-4 h-4 mr-2" />
          {{ isBulkTranslating ? 'Traduciendo...' : 'Auto-Traducir Todo (IA)' }}
        </button>
        <AddTranslationDialog
          :appContext="currentAppTab"
          :langs="activeLangs"
          @created="refreshTables"
        />
        <button class="btn btn-outline" @click="handleGenerate" :disabled="isGenerating">
          {{ isGenerating ? 'Generating...' : 'Generate JSON' }}
        </button>
      </div>
    </div>

    <!-- DaisyUI Tabs for switching Apps -->
    <div role="tablist" class="tabs tabs-border w-full xl:w-1/2 mb-4">
      <a
        role="tab"
        class="tab"
        :class="{ 'tab-active': currentAppTab === 'front' }"
        @click="currentAppTab = 'front'"
      >
        <PanelTopIcon class="w-4 h-4 mr-2" />
        Front App
      </a>
      <a
        role="tab"
        class="tab"
        :class="{ 'tab-active': currentAppTab === 'back' }"
        @click="currentAppTab = 'back'"
      >
        <LayersIcon class="w-4 h-4 mr-2" />
        Back App
      </a>
    </div>

    <div v-show="currentAppTab === 'front'">
      <DataTable
        ref="frontTable"
        :columns="columns"
        :endpoint="endpointFront"
        tableName="translations-table-front"
      />
    </div>

    <div v-show="currentAppTab === 'back'">
      <DataTable
        ref="backTable"
        :columns="columns"
        :endpoint="endpointBack"
        tableName="translations-table-back"
      />
    </div>
  </div>
</template>
