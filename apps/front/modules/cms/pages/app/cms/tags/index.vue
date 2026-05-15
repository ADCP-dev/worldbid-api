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
  },


]);
</script>

<template>
  <div class="container mx-auto py-8">
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-3xl font-bold">Etiquetas</h1>
      <div class="flex items-center gap-3">
        <NuxtLink to="/app/cms/tags/create" class="btn btn-primary">
          Crear etiqueta
        </NuxtLink>
      </div>
    </div>

    <DataTable
      ref="tableRef"
      :columns="columns"
      endpoint="cms/tags"
      table-name="cms-tags-table"
      @row-click="(row: any) => router.push(`/app/cms/tags/${row.id}/edit`)"
    />
  </div>
</template>
