<script setup lang="ts">
import { h, computed } from "vue";
import DataTable from "@/modules/base/ui-app/components/data-table/DataTable.vue";
import AuthorBadge from "@cms/components/cms/AuthorBadge.vue";

definePageMeta({
  layout: "default",
  middleware: "auth",
});

const { categories, fetchCategories } = useCmsCategories();
const router = useRouter();

onMounted(() => {
  fetchCategories();
});

const columns = computed(() => [
  {
    accessorKey: "name",
    headerName: "Nombre",
    header: "Nombre",
    filterType: "string",
  },
  {
    accessorKey: "author",
    id: "author",
    headerName: "Autor",
    header: "Autor",
    enableSorting: false,
    filterType: "string",
    cell: ({ row }: any) => {
      return h(AuthorBadge);
    },
  },
  {
    accessorKey: "description",
    headerName: "Descripción",
    header: "Descripción",
    filterType: "string",
    cell: ({ row }: any) => {
      const category = row.original;
      return h("span", {}, category.description || "—");
    },
  },
  {
    accessorKey: "tags",
    headerName: "Etiquetas",
    header: "Etiquetas",
    enableSorting: false,
    filterType: "string",
    cell: ({ row }: any) => {
      const category = row.original;
      if (!category.tags?.length) {
        return h("span", { class: "text-gray-400" }, "—");
      }
      return h(
        "div",
        { class: "flex gap-1 flex-wrap" },
        category.tags.map((tag: any) =>
          h("span", { class: "badge badge-sm badge-outline" }, tag.name),
        ),
      );
    },
  },

]);
</script>

<template>
  <div class="container mx-auto py-8">
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-3xl font-bold">Categorías</h1>
      <div class="flex items-center gap-3">
        <NuxtLink to="/app/cms/blog/categories/create" class="btn btn-primary">
          Crear categoría
        </NuxtLink>
      </div>
    </div>

    <DataTable
      ref="tableRef"
      :columns="columns"
      :data="categories"
      tableName="cms-blog-categories-table"
      @row-click="(row: any) => router.push(`/app/cms/blog/categories/${row.id}/edit`)"
    />
  </div>
</template>
