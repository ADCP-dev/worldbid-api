<script setup lang="ts">
import { h, computed } from "vue";
import DataTable from "@/modules/base/ui-app/components/data-table/DataTable.vue";

definePageMeta({
  layout: "default",
  middleware: "auth",
});

const router = useRouter();

const columns = computed(() => [
  {
    accessorKey: "name",
    headerName: "Nombre",
    header: "Nombre",
    filterType: "string",
    cell: ({ row }: any) => {
      const page = row.original;
      return h("span", { class: "font-medium" }, page.name || page.title || "—");
    },
  },
  {
    accessorKey: "slug",
    headerName: "Slug",
    header: "Slug",
    filterType: "string",
    cell: ({ row }: any) => {
      const page = row.original;
      return h("span", { class: "font-mono text-sm" }, `/${page.slug}`);
    },
  },
  {
    accessorKey: "section",
    headerName: "Sección",
    header: "Sección",
    filterType: "select",
    options: [
      { value: "", label: "Todos" },
      { value: "landing", label: "Landing" },
      { value: "blog", label: "Blog" },
      { value: "documentation", label: "Documentation" },
      { value: "store", label: "Store" },
    ],
    cell: ({ row }: any) => {
      const page = row.original;
      return h(
        "span",
        { class: "badge badge-ghost capitalize" },
        page.section,
      );
    },
  },
  {
    accessorKey: "isPublished",
    headerName: "Publicado",
    header: "Publicado",
    filterType: "boolean",
    cell: ({ row }: any) => {
      const page = row.original;
      const isPublished = page.isPublished;
      return h(
        "span",
        {
          class: ["badge", isPublished ? "badge-success" : "badge-warning"],
        },
        isPublished ? "Publicado" : "Borrador",
      );
    },
  },

]);
</script>

<template>
  <div class="container mx-auto py-8">
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-3xl font-bold">Páginas</h1>
      <div class="flex items-center gap-3">
        <NuxtLink to="/app/cms/pages/create" class="btn btn-primary">
          Crear página
        </NuxtLink>
      </div>
    </div>

    <DataTable
      ref="tableRef"
      :columns="columns"
      endpoint="cms/pages"
      table-name="cms-pages-table"
      @row-click="(row: any) => router.push(`/app/cms/pages/${row.id}/edit`)"
    />
  </div>
</template>
