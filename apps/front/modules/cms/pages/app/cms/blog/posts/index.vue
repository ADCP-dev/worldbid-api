<script setup lang="ts">
import { h, computed, ref } from "vue";
import DataTable from "@/modules/base/ui-app/components/data-table/DataTable.vue";
import AuthorBadge from "@cms/components/cms/AuthorBadge.vue";

definePageMeta({
  layout: "default",
  middleware: "auth",
});

const router = useRouter();

const tableRef = ref<any>(null);

const columns = computed(() => [
  {
    accessorKey: "title",
    headerName: "Título",
    header: "Título",
    filterType: "string",
    cell: ({ row }: any) => {
      const post = row.original;
      return h("span", { class: "font-medium" }, post.title || post.slug || "—");
    },
  },
  {
    accessorKey: "slug",
    headerName: "Slug",
    header: "Slug",
    filterType: "string",
    cell: ({ row }: any) => {
      const post = row.original;
      return h("span", { class: "font-mono text-sm" }, `/${post.slug}`);
    },
  },
  {
    accessorKey: "author",
    id: "author",
    headerName: "Autor",
    header: "Autor",
    enableSorting: false,
    filterType: "string",
    cell: ({ row }: any) => {
      const post = row.original;
      return h(AuthorBadge, {
        authorName: post.author,
      });
    },
  },
  {
    accessorKey: "categoryName",
    headerName: "Categoría",
    header: "Categoría",
    filterType: "string",
    cell: ({ row }: any) => {
      const post = row.original;
      return h(
        "span",
        { class: "badge badge-ghost" },
        post.categoryName || "—",
      );
    },
  },
  {
    accessorKey: "tags",
    headerName: "Etiquetas",
    header: "Etiquetas",
    enableSorting: false,
    filterType: "string",
    cell: ({ row }: any) => {
      const post = row.original;
      if (!post.tags?.length) {
        return h("span", { class: "text-gray-400" }, "—");
      }
      return h(
        "div",
        { class: "flex gap-1 flex-wrap" },
        post.tags.map((tag: any) =>
          h("span", { class: "badge badge-sm badge-outline" }, tag.name),
        ),
      );
    },
  },
  {
    accessorKey: "isPublished",
    headerName: "Publicado",
    header: "Publicado",
    filterType: "boolean",
    cell: ({ row }: any) => {
      const post = row.original;
      const isPublished = post.isPublished;
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
      <h1 class="text-3xl font-bold">Entradas de blog</h1>
      <div class="flex items-center gap-3">
        <NuxtLink to="/app/cms/blog/posts/create" class="btn btn-primary">
          Crear entrada
        </NuxtLink>
      </div>
    </div>

    <DataTable
      ref="tableRef"
      :columns="columns"
      endpoint="cms/blog/posts"
      table-name="cms-blog-posts-table"
      @row-click="(row: any) => router.push(`/app/cms/blog/posts/${row.id}/edit`)"
    />
  </div>
</template>
