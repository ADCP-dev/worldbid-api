<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

import { useTranslations } from "../../../composables/useTranslations";
import { ref, onMounted, computed, h } from "vue";
import DataTable from "@/modules/base/ui-app/components/data-table/DataTable.vue";
import TranslationAccordionCell from "~/modules/base/translations/components/TranslationAccordionCell.vue";
import AddTranslationDialog from "~/modules/base/translations/components/AddTranslationDialog.vue";
import DeleteButton from "@/modules/base/ui-app/components/data-table/buttons/DeleteButton.vue";
import { toast } from "vue-sonner";
import { BotIcon, LayersIcon, PanelTopIcon } from "lucide-vue-next";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const { getLangs, deleteTranslation, generateJson, bulkTranslate, syncTranslations } =
  useTranslations();

const langs = ref<any[]>([]);
const activeLangs = computed(() => langs.value.filter((l) => l.isActive));
// We will use Tabs to switch between Apps. Default is 'front'.
const currentAppTab = ref("front");

// Dynamic endpoints based on current tab. We append &app=front/back so the server filters it.
const endpointFront = computed(() => `translations?app=front`);
const endpointBack = computed(() => `translations?app=back`);

// To force reload DataTable when inline updates happen
const frontTable = ref<any>(null);
const backTable = ref<any>(null);
const isGenerating = ref(false);
const isBulkTranslating = ref(false);
const isSyncing = ref(false);

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
    headerName: t("mod.translations.section"),
    header: t("mod.translations.section"),
    filterType: "string",
  },
  {
    accessorKey: "key",
    headerName: t("mod.translations.key"),
    header: t("mod.translations.key"),
    filterType: "string",
  },
  {
    id: "content",
    headerName: t("mod.translations.translations"),
    header: t("mod.translations.translations"),
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
        },
      });
    },
  },
  {
    id: "actions",
    headerName: t("mod.translations.actions"),
    header: t("mod.translations.actions"),
    enableSorting: false,
    cell: ({ row }: any) => {
      const group = row.original;
      return h(DeleteButton, {
        onClick: async () => {
          if (confirm(t("mod.translations.confirmDelete"))) {
            try {
              await Promise.all(
                group.translations.map((t: any) => deleteTranslation(t.id)),
              );
              refreshTables();
              toast.success(t("mod.translations.toast.deleted"));
            } catch (error) {
              console.error(error);
              toast.error(t("mod.translations.toast.deleteFailed"));
            }
          }
        },
      });
    },
  },
]);

const handleGenerate = async () => {
  isGenerating.value = true;
  try {
    await generateJson();
    toast.success(t("mod.translations.toast.generated"));
  } catch (error) {
    console.error(error);
    toast.error(t("mod.translations.toast.generateFailed"));
  } finally {
    isGenerating.value = false;
  }
};

const handleBulkTranslate = async () => {
  isBulkTranslating.value = true;
  try {
    const result = await bulkTranslate(currentAppTab.value);
    toast.success(result.message || t("mod.translations.toast.bulkComplete"));
    refreshTables();
  } catch (error: any) {
    console.error(error);
    toast.error(
      t("mod.translations.toast.bulkFailed") +
        `: ${error.message || "Unknown error"}`,
    );
  } finally {
    isBulkTranslating.value = false;
  }
};

const handleSync = async () => {
  isSyncing.value = true;
  try {
    const result = await syncTranslations();
    toast.success(`Sincronizado: ${result.files?.length ?? 0} archivos generados`);
  } catch (e: any) {
    toast.error(e?.message || 'Error al sincronizar');
  } finally {
    isSyncing.value = false;
  }
};

onMounted(async () => {
  await fetchLangs();
});
</script>

<template>
  <div class="p-1 md:p-6">
    <div
      class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4"
    >
      <h1 class="text-2xl font-bold">{{ $t("mod.translations.title") }}</h1>
      <div class="flex flex-wrap gap-2">
        <button
          class="btn btn-outline"
          :disabled="isBulkTranslating"
          @click="handleBulkTranslate"
        >
          <BotIcon class="w-4 h-4 mr-2" />
          {{
            isBulkTranslating
              ? $t("mod.translations.bulkTranslatingMsg")
              : $t("mod.translations.autoTranslateBtn")
          }}
        </button>
        <AddTranslationDialog
          :app-context="currentAppTab"
          :langs="activeLangs"
          @created="refreshTables"
        />
        <button
          class="btn btn-outline"
          :disabled="isGenerating"
          @click="handleGenerate"
        >
          {{
            isGenerating
              ? $t("mod.translations.generatingMsg")
              : $t("mod.translations.generateJsonBtn")
          }}
        </button>
        <button
          class="btn btn-primary"
          @click="handleSync"
          :disabled="isSyncing"
        >
          {{ isSyncing ? 'Sincronizando...' : 'Sincronizar' }}
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
        {{ $t("mod.translations.frontAppTab") }}
      </a>
      <a
        role="tab"
        class="tab"
        :class="{ 'tab-active': currentAppTab === 'back' }"
        @click="currentAppTab = 'back'"
      >
        <LayersIcon class="w-4 h-4 mr-2" />
        {{ $t("mod.translations.backAppTab") }}
      </a>
    </div>

    <div v-show="currentAppTab === 'front'">
      <DataTable
        ref="frontTable"
        :columns="columns"
        :endpoint="endpointFront"
        table-name="translations-table-front"
      />
    </div>

    <div v-show="currentAppTab === 'back'">
      <DataTable
        ref="backTable"
        :columns="columns"
        :endpoint="endpointBack"
        table-name="translations-table-back"
      />
    </div>
  </div>
</template>
