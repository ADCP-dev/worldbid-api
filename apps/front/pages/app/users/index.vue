<script setup lang="ts">
import { ref, computed, h, resolveComponent } from "vue";
import { useDeleteUserMutation } from "@/composables/useUsers";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import {
  UserIcon,
  KeyIcon,
  EditIcon,
  Trash2Icon,
  ShieldIcon,
  PlusIcon,
  EllipsisVerticalIcon,
} from "lucide-vue-next";

import DataTable from "@/modules/base/ui-app/components/data-table/DataTable.vue";
import UserFormDialog from "@/components/users/UserFormDialog.vue";
import UserPasswordDialog from "@/components/users/UserPasswordDialog.vue";
import UserRoleDialog from "@/components/users/UserRoleDialog.vue";
import TableActionMenu from "@/components/ui/TableActionMenu.vue";

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const deleteUserMutation = useDeleteUserMutation();
const { t } = useI18n();

const tableRef = ref<any>(null);
const userFormDialogRef = ref<any>(null);
const userPasswordDialogRef = ref<any>(null);
const userRoleDialogRef = ref<any>(null);

const selectedUser = ref<any>(null);

const refreshTable = () => {
  tableRef.value?.fetchData();
};

const handleCreate = () => {
  selectedUser.value = null;
  userFormDialogRef.value?.openDialog();
};

const handleEdit = (user: any) => {
  selectedUser.value = user;
  userFormDialogRef.value?.openDialog();
};

const handleChangePassword = (user: any) => {
  selectedUser.value = user;
  userPasswordDialogRef.value?.openDialog();
};

const handleChangeRole = (user: any) => {
  selectedUser.value = user;
  userRoleDialogRef.value?.openDialog();
};

const handleDelete = async (user: any) => {
  if (confirm(t("mod.users.messages.deleteConfirm", { email: user.email }))) {
    try {
      await deleteUserMutation.mutateAsync(user.id);
      toast.success(t("mod.users.messages.deleteSuccess"));
      refreshTable();
    } catch (error: any) {
      if (import.meta.dev) console.error(error);
      toast.error(t("mod.users.messages.deleteError"));
    }
  }
};

const columns = computed(() => [
  {
    accessorKey: "id",
    headerName: t("mod.users.table.ID"),
    header: t("mod.users.table.ID"),
    filterType: "number" as const,
  },
  {
    accessorKey: "firstName",
    headerName: t("mod.users.table.firstName"),
    header: t("mod.users.table.firstName"),
    filterType: "string" as const,
  },
  {
    accessorKey: "lastName",
    headerName: t("mod.users.table.lastName"),
    header: t("mod.users.table.lastName"),
    filterType: "string" as const,
  },
  {
    accessorKey: "email",
    headerName: t("mod.users.table.email"),
    header: t("mod.users.table.email"),
    filterType: "string" as const,
  },
  {
    accessorKey: "role.id",
    id: "role.id",
    headerName: t("mod.users.table.role"),
    header: t("mod.users.table.role"),
    enableSorting: false,
    filterType: "select" as const,
    options: [
      { value: "", label: t("mod.users.table.roles.all") },
      { value: "1", label: t("mod.users.table.roles.admin") },
      { value: "2", label: t("mod.users.table.roles.user") },
    ],
    cell: ({ row }: any) => {
      const user = row.original;
      return h(
        "div",
        { class: "badge badge-outline" },
        user.role?.name || "User",
      );
    },
  },
  {
    accessorKey: "status.id",
    id: "status.id",
    headerName: t("mod.users.table.status"),
    header: t("mod.users.table.status"),
    enableSorting: false,
    filterType: "select" as const,
    options: [
      { value: "", label: t("mod.users.table.statuses.all") },
      { value: "1", label: t("mod.users.table.statuses.active") },
      { value: "2", label: t("mod.users.table.statuses.inactive") },
    ],
    cell: ({ row }: any) => {
      const user = row.original;
      const statusName = user.status?.name || "Activo";
      const badgeClass =
        statusName === "Activo" ? "badge-success text-white" : "badge-neutral";
      return h("div", { class: ["badge", badgeClass] }, statusName);
    },
  },
  {
    id: "actions",
    headerName: t("mod.users.table.actions"),
    header: t("mod.users.table.actions"),
    enableSorting: false,
    cell: ({ row }: any) => {
      const user = row.original;
      return h(
        TableActionMenu,
        {},
        {
          trigger: () =>
            h("button", { class: "btn btn-ghost btn-xs btn-square" }, [
              h(EllipsisVerticalIcon, { class: "w-4 h-4" }),
            ]),
          default: ({ close }: { close: () => void }) => [
            h("li", {}, [
              h(
                "button",
                {
                  onClick: () => {
                    close();
                    handleEdit(user);
                  },
                },
                [
                  h(EditIcon, { class: "w-4 h-4" }),
                  t("mod.users.actions.edit"),
                ],
              ),
            ]),
            h("li", {}, [
              h(
                "button",
                {
                  onClick: () => {
                    close();
                    handleChangeRole(user);
                  },
                },
                [
                  h(ShieldIcon, { class: "w-4 h-4" }),
                  t("mod.users.actions.changeRole"),
                ],
              ),
            ]),
            h("li", {}, [
              h(
                "button",
                {
                  onClick: () => {
                    close();
                    handleChangePassword(user);
                  },
                },
                [
                  h(KeyIcon, { class: "w-4 h-4" }),
                  t("mod.users.actions.changePassword"),
                ],
              ),
            ]),
            h("li", { class: "border-t border-base-200 mt-1 pt-1" }, [
              h(
                "button",
                {
                  class: "text-error",
                  onClick: () => {
                    close();
                    handleDelete(user);
                  },
                },
                [
                  h(Trash2Icon, { class: "w-4 h-4" }),
                  t("mod.users.actions.delete"),
                ],
              ),
            ]),
          ],
        },
      );
    },
  },
]);
</script>

<template>
  <div class="p-1 md:p-6">
    <div
      class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4"
    >
      <div>
        <h1 class="text-2xl font-bold flex items-center gap-2">
          <UserIcon class="w-6 h-6 text-primary" />
          {{ $t("mod.users.title") }}
        </h1>
        <p class="text-base-content/70 mt-1">
          {{ $t("mod.users.description") }}
        </p>
      </div>

      <div class="flex gap-2">
        <button class="btn btn-primary" @click="handleCreate">
          <PlusIcon class="w-4 h-4 mr-2" />
          {{ $t("mod.users.actions.create") }}
        </button>
      </div>
    </div>

    <!-- User Table -->
    <DataTable
      ref="tableRef"
      :columns="columns"
      endpoint="users"
      table-name="admin-users-table"
    />

    <!-- Dialogs -->
    <UserFormDialog
      ref="userFormDialogRef"
      :user="selectedUser"
      @saved="refreshTable"
    />

    <UserPasswordDialog
      ref="userPasswordDialogRef"
      :user="selectedUser"
      @saved="refreshTable"
    />

    <UserRoleDialog
      ref="userRoleDialogRef"
      :user="selectedUser"
      @saved="refreshTable"
    />
  </div>
</template>
