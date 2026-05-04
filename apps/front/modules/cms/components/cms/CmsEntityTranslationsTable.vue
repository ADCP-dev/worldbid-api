<script setup lang="ts">
import { h, computed, ref } from "vue";
import DataTable from "@/modules/base/ui-app/components/data-table/DataTable.vue";
import { fetchWrapper } from "@/helpers/fetch-wrapper";
import { toast } from "vue-sonner";

interface Props {
  endpoint: string;
  tableName?: string;
  categoryPrefix?: string;
  entityName?: string;
  entityId?: string;
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

const defaultCategory = computed(() => {
  const match = props.endpoint.match(/filter\[category\]=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : '';
});

const showAddModal = ref(false);
const newSection = ref('');
const newKey = ref('');
const newContent = ref<Record<string, string>>({});

function openAddModal() {
  newSection.value = '';
  newKey.value = '';
  newContent.value = {};
  for (const lang of activeLangs.value) {
    newContent.value[lang.code] = '';
  }
  showAddModal.value = true;
}

function closeAddModal() {
  showAddModal.value = false;
}

async function handleAddTranslation() {
  const section = newSection.value.trim();
  const key = newKey.value.trim();
  if (!section || !key) return;

  const hasContent = Object.values(newContent.value).some((v) => v.trim());
  if (!hasContent) return;

  try {
    for (const lang of activeLangs.value) {
      const content = newContent.value[lang.code]?.trim();
      if (!content) continue;

      await fetchWrapper.post(`${baseURL}/translations`, {
        langCode: lang.code,
        section,
        key,
        content,
        ...(defaultCategory.value && { category: defaultCategory.value }),
        ...(props.entityName && { entityName: props.entityName }),
        ...(props.entityId && { entityId: props.entityId }),
      });
    }
    toast.success("Traducción creada");
    closeAddModal();
    refreshTable();
  } catch (err) {
    console.error("Failed to create translation", err);
    toast.error("Error al crear traducción");
  }
}

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
  <div>
    <div class="flex justify-between items-center mb-3">
      <button type="button" class="btn btn-sm btn-outline" @click="openAddModal">
        + Agregar traducción
      </button>
    </div>

    <DataTable
      ref="tableRef"
      :columns="columns"
      :endpoint="endpoint"
      :table-name="tableName || 'entity-translations-table'"
    />

    <dialog :class="{ 'modal-open modal-bottom sm:modal-middle': showAddModal }" class="modal">
      <div class="modal-box">
        <h3 class="text-lg font-bold mb-4">Nueva traducción</h3>

        <div class="space-y-4">
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text">Sección</span>
            </label>
            <input
              v-model="newSection"
              type="text"
              class="input input-bordered input-sm w-full"
              placeholder="Ej: page, hero, footer"
            >
          </div>

          <div class="form-control">
            <label class="label py-1">
              <span class="label-text">Clave</span>
            </label>
            <input
              v-model="newKey"
              type="text"
              class="input input-bordered input-sm w-full"
              placeholder="Ej: title, description, cta"
            >
          </div>

          <div class="divider my-1">Traducciones</div>

          <div v-for="lang in activeLangs" :key="lang.id" class="form-control">
            <label class="label py-1">
              <span class="label-text-alt uppercase font-bold text-base-content/70">
                {{ lang.code.toUpperCase() }} — {{ lang.name }}
              </span>
            </label>
            <textarea
              v-model="newContent[lang.code]"
              class="textarea textarea-bordered textarea-sm w-full min-h-[60px]"
              :placeholder="`Traducción en ${lang.name}`"
            />
          </div>
        </div>

        <div class="modal-action">
          <button type="button" class="btn btn-sm btn-ghost" @click="closeAddModal">
            Cancelar
          </button>
          <button type="button" class="btn btn-sm btn-primary" @click="handleAddTranslation">
            Guardar
          </button>
        </div>
      </div>

      <form method="dialog" class="modal-backdrop">
        <button @click="closeAddModal">close</button>
      </form>
    </dialog>
  </div>
</template>
