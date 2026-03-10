<script setup lang="ts">
import { h, ref } from "vue";
import DataTable from "@/modules/base/ui-app/components/data-table/DataTable.vue";
import { toast } from "vue-sonner";
import {
  Pencil,
  Trash2,
  User,
  Mail,
  Shield,
  CheckCircle2,
  XCircle,
} from "lucide-vue-next";

// Sample data for the demo
const users = ref([
  {
    id: 1,
    name: "Adrián Rodríguez",
    email: "adrian@example.com",
    role: "admin",
    status: "active",
    createdAt: "2024-01-15",
  },
  {
    id: 2,
    name: "Juan Pérez",
    email: "juan@example.com",
    role: "user",
    status: "active",
    createdAt: "2024-02-10",
  },
  {
    id: 3,
    name: "María García",
    email: "maria@example.com",
    role: "manager",
    status: "inactive",
    createdAt: "2024-03-05",
  },
  {
    id: 4,
    name: "Elena López",
    email: "elena@example.com",
    role: "user",
    status: "active",
    createdAt: "2024-01-20",
  },
  {
    id: 5,
    name: "Carlos Ruiz",
    email: "carlos@example.com",
    role: "user",
    status: "pending",
    createdAt: "2024-02-25",
  },
]);

const columns = [
  {
    accessorKey: "name",
    headerName: "Usuario",
    header: "Usuario",
    filterType: "string",
    cell: ({ row }: any) => {
      return h("div", { class: "flex items-center gap-3" }, [
        h("div", { class: "avatar placeholder" }, [
          h(
            "div",
            {
              class:
                "bg-neutral text-neutral-content rounded-full w-8 flex items-center justify-center",
            },
            [h("span", { class: "text-xs" }, row.original.name.charAt(0))],
          ),
        ]),
        h("div", [
          h("div", { class: "font-bold" }, row.original.name),
          h("div", { class: "text-sm opacity-50" }, `ID: ${row.original.id}`),
        ]),
      ]);
    },
  },
  {
    accessorKey: "email",
    headerName: "Email",
    header: "Email",
    filterType: "string",
  },
  {
    accessorKey: "role",
    headerName: "Rol",
    header: "Rol",
    filterType: "select",
    options: [
      { label: "Todos", value: "" },
      { label: "Admin", value: "admin" },
      { label: "User", value: "user" },
      { label: "Manager", value: "manager" },
    ],
    cell: ({ row }: any) => {
      const role = row.original.role;
      const badgeClass =
        role === "admin"
          ? "badge-primary"
          : role === "manager"
            ? "badge-secondary"
            : "badge-ghost";
      return h("span", { class: `badge ${badgeClass} capitalize` }, role);
    },
  },
  {
    accessorKey: "status",
    headerName: "Estado",
    header: "Estado",
    filterType: "boolean",
    cell: ({ row }: any) => {
      const status = row.original.status;
      const colorClass =
        status === "active"
          ? "text-success"
          : status === "pending"
            ? "text-warning"
            : "text-error";
      const Icon =
        status === "active"
          ? CheckCircle2
          : status === "pending"
            ? Shield
            : XCircle;

      return h("div", { class: `flex items-center gap-2 ${colorClass}` }, [
        h(Icon, { class: "w-4 h-4" }),
        h("span", { class: "capitalize font-medium" }, status),
      ]);
    },
  },
  {
    accessorKey: "createdAt",
    headerName: "Fecha Alta",
    header: "Fecha Alta",
    filterType: "date",
  },
  {
    id: "actions",
    headerName: "Acciones",
    header: "Acciones",
    enableSorting: false,
    cell: ({ row }: any) => {
      return h("div", { class: "flex items-center gap-2" }, [
        h(
          "button",
          {
            class: "btn btn-ghost btn-xs btn-square",
            onClick: (e: Event) => {
              e.stopPropagation();
              toast.info(`Editando a ${row.original.name}`);
            },
          },
          [h(Pencil, { class: "w-4 h-4" })],
        ),
        h(
          "button",
          {
            class: "btn btn-ghost btn-xs btn-square text-error",
            onClick: (e: Event) => {
              e.stopPropagation();
              toast.error(`Eliminando a ${row.original.name}`);
            },
          },
          [h(Trash2, { class: "w-4 h-4" })],
        ),
      ]);
    },
  },
];

const handleRowClick = (row: any) => {
  toast(`Fila seleccionada: ${row.name}`, {
    description: `Email: ${row.email}`,
  });
};
</script>

<template>
  <div class="p-1 md:p-6 max-w-7xl mx-auto">
    <div class="mb-8">
      <h1 class="text-3xl font-bold mb-2">DataTable Demo</h1>
      <p class="text-base-content/60">
        Ejemplo de uso del componente DataTable con filtrado, ordenación,
        paginación y celdas personalizadas.
      </p>
    </div>

    <div class="card bg-base-100 shadow-xl border border-base-content/5">
      <div class="card-body p-0">
        <div
          class="p-6 border-b border-base-content/5 flex justify-between items-center"
        >
          <h2 class="card-title text-xl">Gestión de Usuarios</h2>
          <button
            class="btn btn-primary btn-sm"
            @click="toast.success('Abriendo formulario...')"
          >
            Nuevo Usuario
          </button>
        </div>

        <div class="p-6">
          <DataTable
            :columns="columns"
            :data="users"
            tableName="demo-users-table"
            @row-click="handleRowClick"
          />
        </div>
      </div>
    </div>

    <div class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="card bg-base-100 shadow-md border border-base-content/5">
        <div class="card-body">
          <h3 class="font-bold text-lg mb-2">Características</h3>
          <ul
            class="list-disc list-inside space-y-1 text-sm text-base-content/70"
          >
            <li>Filtrado global e individual por columna</li>
            <li>Ordenación ascendente y descendente</li>
            <li>Paginación configurable</li>
            <li>Visibilidad de columnas dinámica</li>
            <li>Estado persistente en Pinia</li>
            <li>Renderizado de celdas mediante render functions (h)</li>
          </ul>
        </div>
      </div>

      <div class="card bg-base-100 shadow-md border border-base-content/5">
        <div class="card-body">
          <h3 class="font-bold text-lg mb-2">Configuración</h3>
          <div class="mockup-code text-xs">
            <pre><code>&lt;DataTable
  :columns="columns"
  :data="users"
  tableName="users-table"
  @row-click="handleRowClick"
/&gt;</code></pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
