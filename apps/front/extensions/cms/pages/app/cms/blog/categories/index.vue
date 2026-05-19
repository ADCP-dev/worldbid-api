<script setup lang="ts">
import { h, computed } from "vue";
import DataTable from "@/modules/base/ui-app/components/data-table/DataTable.vue";

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
    accessorKey: "description",
    headerName: "Descripción",
    header: "Descripción",
    filterType: "string",
    cell: ({ row }: any) => {
      const category = row.original;
      return h("span", {}, category.description || "—");
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
      table-name="cms-blog-categories-table"
      @row-click="(row: any) => router.push(`/app/cms/blog/categories/${row.id}/edit`)"
    />
  </div>
</template>
