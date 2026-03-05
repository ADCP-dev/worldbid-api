<script setup lang="ts">
import { ref, computed, h, resolveComponent } from 'vue';
import { useUsers } from '~/composables/useUsers';
import { toast } from 'vue-sonner';
import {
  UserIcon,
  KeyIcon,
  EditIcon,
  Trash2Icon,
  ShieldIcon,
  PlusIcon,
  EllipsisVerticalIcon
} from 'lucide-vue-next';

import DataTable from '@/modules/ui-app/components/data-table/DataTable.vue';
import UserFormDialog from '~/components/users/UserFormDialog.vue';
import UserPasswordDialog from '~/components/users/UserPasswordDialog.vue';
import UserRoleDialog from '~/components/users/UserRoleDialog.vue';
import TableActionMenu from '~/components/ui/TableActionMenu.vue';

const { deleteUser } = useUsers();

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
  if (confirm(`¿Estás seguro de que deseas eliminar al usuario ${user.email}?`)) {
    try {
      await deleteUser(user.id);
      toast.success('Usuario eliminado correctamente');
      refreshTable();
    } catch (error: any) {
      console.error(error);
      toast.error('Error al eliminar usuario');
    }
  }
};

const columns = computed(() => [
  {
    accessorKey: "id",
    headerName: "ID",
    header: "ID",
    filterType: "number"
  },
  {
    accessorKey: "firstName",
    headerName: "Nombre",
    header: "Nombre",
    filterType: "string"
  },
  {
    accessorKey: "lastName",
    headerName: "Apellidos",
    header: "Apellidos",
    filterType: "string"
  },
  {
    accessorKey: "email",
    headerName: "Email",
    header: "Email",
    filterType: "string"
  },
  {
    accessorKey: "role.id",
    id: "role.id",
    headerName: "Rol",
    header: "Rol",
    enableSorting: false,
    filterType: "select",
    options: [
      { value: '', label: 'Todos' },
      { value: '1', label: 'Admin' },
      { value: '2', label: 'User' }
    ],
    cell: ({ row }: any) => {
      const user = row.original;
      return h('div', { class: 'badge badge-outline' }, user.role?.name || 'User');
    }
  },
  {
    accessorKey: "status.id",
    id: "status.id",
    headerName: "Estado",
    header: "Estado",
    enableSorting: false,
    filterType: "select",
    options: [
      { value: '', label: 'Todos' },
      { value: '1', label: 'Activo' },
      { value: '2', label: 'Inactivo' }
    ],
    cell: ({ row }: any) => {
      const user = row.original;
      const statusName = user.status?.name || 'Activo';
      const badgeClass = statusName === 'Activo' ? 'badge-success text-white' : 'badge-neutral';
      return h('div', { class: ['badge', badgeClass] }, statusName);
    }
  },
  {
    id: "actions",
    headerName: "Acciones",
    header: "Acciones",
    enableSorting: false,
    cell: ({ row }: any) => {
      const user = row.original;
      return h(TableActionMenu, {}, {
        trigger: () => h('button', { class: 'btn btn-ghost btn-xs btn-square' }, [
          h(EllipsisVerticalIcon, { class: 'w-4 h-4' })
        ]),
        default: ({ close }: { close: () => void }) => [
          h('li', {}, [
            h('button', { onClick: () => { close(); handleEdit(user); } }, [
              h(EditIcon, { class: 'w-4 h-4' }), 'Editar'
            ])
          ]),
          h('li', {}, [
            h('button', { onClick: () => { close(); handleChangeRole(user); } }, [
              h(ShieldIcon, { class: 'w-4 h-4' }), 'Cambiar Rol / Estado'
            ])
          ]),
          h('li', {}, [
            h('button', { onClick: () => { close(); handleChangePassword(user); } }, [
              h(KeyIcon, { class: 'w-4 h-4' }), 'Cambiar Contraseña'
            ])
          ]),
          h('li', { class: 'border-t border-base-200 mt-1 pt-1' }, [
            h('button', { class: 'text-error', onClick: () => { close(); handleDelete(user); } }, [
              h(Trash2Icon, { class: 'w-4 h-4' }), 'Eliminar'
            ])
          ])
        ]
      });
    }
  }
]);

</script>

<template>
  <div class="p-1 md:p-6">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
      <div>
        <h1 class="text-2xl font-bold flex items-center gap-2">
          <UserIcon class="w-6 h-6 text-primary" />
          Gestión de Usuarios
        </h1>
        <p class="text-base-content/70 mt-1">Administra los usuarios de la plataforma</p>
      </div>

      <div class="flex gap-2">
        <button class="btn btn-primary" @click="handleCreate">
          <PlusIcon class="w-4 h-4 mr-2" />
          Nuevo Usuario
        </button>
      </div>
    </div>

    <!-- User Table -->
    <DataTable
      ref="tableRef"
      :columns="columns"
      endpoint="users"
      tableName="admin-users-table"
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
