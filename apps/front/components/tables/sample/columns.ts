import { h } from "vue";
import type { MyColumnDef } from "~/components/custom/data-table/types";
import SortableHeader from "~/components/custom/data-table/SortableHeader.vue";
import Dropdown from "./Dropdown.vue";
import { CheckCircle, XCircle } from "lucide-vue-next";

// User type for the UsersTable
export interface User {
  id: number;
  email: string;
  created_at: string;
  updated_at: string;
  status: string;
  user_data: {
    name?: string;
    dni?: string;
    address?: string;
    postal_code?: string;
    municipality?: { municipality_code?: string };
    business?: { billing_name?: string };
    province?: { name?: string };
    birth_date?: string;
    mobile_number?: string;
    mobile_prefix?: string;
    landline_number?: string;
    landline_prefix?: string;
    contract_signed?: boolean;
  };
}

// Helper for status color
function statusClass(status: string) {
  switch (status) {
    case "active":
      return "bg-green-700";
    case "disable":
      return "bg-red-700";
    case "new":
      return "bg-blue-500";
    default:
      return "bg-gray-400";
  }
}

function mapStatus(status: string) {
  switch (status) {
    case "active":
      return "Activo";
    case "disable":
      return "Deshabilitado";
    case "new":
      return "Nuevo";
    default:
      return "Desconocido";
  }
}

export const columns: MyColumnDef<User>[] = [
  {
    accessorKey: "id",
    header: "Acciones",
    cell: ({ row }) => h(Dropdown, { user: row.original }),
    enableSorting: false,
    enableColumnFilter: false,
  },
  {
    accessorKey: "id",
    header: "Id",
    cell: ({ row }) => row.original.id,
  },
  {
    accessorKey: "email",
    header: "Email",
    filterType: "string",
    cell: ({ row }) =>
      h(
        "a",
        { href: `mailto:${row.original.email}`, class: "text-primary-500" },
        row.original.email,
      ),
  },
  {
    accessorKey: "user_data.name",
    header: "Datos",
    filterType: "string",
    cell: ({ row }) =>
      `${row.original.user_data?.name ?? ""}\n${
        row.original.user_data?.dni ?? ""
      }`,
  },
  {
    accessorKey: "user_data.mobile_number",
    header: "Telefono",
    filterType: "string",
    cell: ({ row }) => [
      row.original.user_data?.mobile_number
        ? h(
            "a",
            {
              href: `https://wa.me/${row.original.user_data.mobile_prefix}${row.original.user_data.mobile_number}`,
              class: "text-primary-500",
              target: "_blank",
              rel: "noopener noreferrer",
            },
            `+${row.original.user_data.mobile_prefix} ${row.original.user_data.mobile_number}`,
          )
        : null,
      row.original.user_data?.landline_number
        ? h(
            "a",
            {
              href: `https://wa.me/${row.original.user_data.landline_prefix}${row.original.user_data.landline_number}`,
              class: "text-primary-500",
              target: "_blank",
              rel: "noopener noreferrer",
            },
            `+${row.original.user_data.landline_prefix} ${row.original.user_data.landline_number}`,
          )
        : null,
    ],
  },
  {
    accessorKey: "user_data.address",
    header: "Dirección",
    filterType: "string",
    cell: ({ row }) => row.original.user_data?.address ?? "",
  },
  {
    accessorKey: "user_data.postal_code",
    header: "CP",
    cell: ({ row }) => row.original.user_data?.postal_code ?? "",
  },
  {
    accessorKey: "user_data.municipality.municipality_code",
    header: "CM",
    cell: ({ row }) =>
      row.original.user_data?.municipality?.municipality_code ?? "",
  },
  {
    accessorKey: "user_data.business.billing_name",
    header: "Empresa",
    filterType: "select",
    options: [
      { label: "Todos", value: "" },
      { label: "ACME Corporate S.L.", value: "ACME Corporate S.L." },
      { label: "ACME Canarias S.L.", value: "ACME Canarias S.L." },
    ],
    cell: ({ row }) => row.original.user_data?.business?.billing_name ?? "",
  },
  {
    accessorKey: "user_data.province.name",
    header: "Provincia",
    filterType: "string",
    cell: ({ row }) => row.original.user_data?.province?.name ?? "",
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => h(SortableHeader, { column, label: "Creación" }),
    headerName: "Creación",
    filterType: "date",
    cell: ({ row }) =>
      new Date(row.original.created_at).toLocaleDateString("es-ES"),
  },
  {
    accessorKey: "updated_at",
    header: ({ column }) =>
      h(SortableHeader, { column, label: "Actualización" }),
    headerName: "Actualización",
    filterType: "date",
    cell: ({ row }) =>
      new Date(row.original.updated_at).toLocaleDateString("es-ES"),
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) =>
      h(
        "div",
        {
          class: `text-center text-white rounded-full px-2 py-1 ${statusClass(
            row.original.status,
          )}`,
        },
        mapStatus(row.original.status),
      ),
  },
  {
    accessorKey: "user_data.contract_signed",
    header: "Contrato firmado",
    filterType: "boolean",
    cell: ({ row }) =>
      h("div", { class: "flex justify-center items-center" }, [
        h(row.original.user_data?.contract_signed ? CheckCircle : XCircle, {
          class: [
            "h-4",
            row.original.user_data?.contract_signed
              ? "text-green-500"
              : "text-red-500",
          ],
        }),
      ]),
  },
];
