<script setup lang="ts">
import { h, computed, ref } from "vue";
import DataTable from "@/modules/base/ui-app/components/data-table/DataTable.vue";
import { fetchWrapper } from "@/helpers/fetch-wrapper";
import { toast } from "vue-sonner";

interface Props {
  endpoint: string;
  tableName?: string;
}

const props = defineProps<Props>();

const tableRef = ref<any>(null);
const config = useRuntimeConfig();
const baseURL = `${config.public.apiUrl}${config.public.apiPrefix}`;

const { getLangs } = useTranslations();
const langs = ref<any[]>([]);
const activeLangs = computed(() => langs.value.filter((l) => l.isActive));

const fetchLangs = async () => {
  langs.value = await getLangs();
};

onMounted(() => {
  fetchLangs();
});

const refreshTable = () => {
  tableRef.value?.fetchData();
};

const handleBlur = async (translation: any, event: Event) => {
  const newContent = (event.target as HTMLTextAreaElement).value.trim();
  if (translation.content === newContent) return;

  try {
    if (translation.id) {
      if (newContent) {
        await fetchWrapper.patch(`${baseURL}/translations/${translation.id}`, {
          content: newContent,
        });
      } else {
        await fetchWrapper.delete(`${baseURL}/translations/${translation.id}`);
      }
    } else if (newContent) {
      await fetchWrapper.post(`${baseURL}/translations`, {
        langCode: translation.langCode,
        section: translation.section,
        key: translation.key,
        content: newContent,
        category: translation.category,
        entityName: translation.entityName,
        entityId: translation.entityId,
      });
    }
    toast.success("Traducción guardada");
    refreshTable();
  } catch (err) {
    console.error("Failed to update translation", err);
    toast.error("Error al guardar traducción");
  }
};

const columns = computed(() => [
  {
    accessorKey: "section",
    headerName: "Sección",
    header: "Sección",
    filterType: "string",
    cell: ({ row }: any) => {
      const section = row.original.section;
      return h("span", { class: "badge badge-ghost badge-sm" }, section || "—");
    },
  },
  {
    accessorKey: "key",
    headerName: "Clave",
    header: "Clave",
    filterType: "string",
    cell: ({ row }: any) => {
      return h("span", { class: "font-medium" }, row.original.key);
    },
  },
  {
    id: "translations",
    headerName: "Traducciones",
    header: "Traducciones",
    enableSorting: false,
    cell: ({ row }: any) => {
      const group = row.original;
      const translations = group.translations || [];

      return h(
        "div",
        { class: "collapse collapse-arrow bg-base-100 border w-full rounded-md shadow-sm" },
        [
          h("input", { type: "checkbox" }),
          h(
            "div",
            {
              class:
                "collapse-title py-2 px-4 hover:bg-base-200/50 text-left text-sm font-normal flex gap-2 items-center overflow-hidden cursor-pointer min-h-0",
            },
            translations.length > 0 && translations[0]
              ? h("div", { class: "flex gap-2 items-center truncate max-w-[200px]" }, [
                  h("span", {}, translations[0].lang?.code?.toUpperCase() || "🌐"),
                  h("span", { class: "truncate text-base-content" }, translations[0].content),
                ])
              : h("span", { class: "italic opacity-50" }, "Sin traducciones"),
          ),
          h(
            "div",
            { class: "collapse-content bg-base-200/20 px-4" },
            h("div", { class: "flex-grow space-y-4" },
              activeLangs.value.map((lang: any) => {
                const existing = translations.find(
                  (t: any) => t.lang?.code === lang.code || t.langCode === lang.code,
                );
                return h("div", { key: lang.id, class: "form-control w-full" }, [
                  h(
                    "label",
                    { class: "label py-1" },
                    h(
                      "span",
                      { class: "label-text-alt uppercase font-bold flex gap-2 items-center text-base-content/70" },
                      [h("span", {}, lang.code.toUpperCase()), lang.name],
                    ),
                  ),
                  h("textarea", {
                    class: "textarea textarea-bordered textarea-sm w-full min-h-[60px]",
                    value: existing?.content || "",
                    placeholder: `Traducción en ${lang.name}`,
                    onBlur: (e: Event) =>
                      handleBlur(
                        {
                          ...existing,
                          langCode: lang.code,
                          section: group.section,
                          key: group.key,
                          category: group.category,
                          entityName: group.entityName,
                          entityId: group.entityId,
                        },
                        e,
                      ),
                  }),
                ]);
              }),
            ),
          ),
        ],
      );
    },
  },
]);
</script>

<template>
  <DataTable
    ref="tableRef"
    :columns="columns"
    :endpoint="endpoint"
    :table-name="tableName || 'entity-translations-table'"
  />
</template>
