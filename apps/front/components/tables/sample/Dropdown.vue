<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-vue-next";
import type { User } from "./columns";
const props = defineProps<{ user: User }>();

const showConsentOption = computed(() => {
  const birthDate = props.user.user_data?.birth_date;
  if (!birthDate) return false;
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age < 18;
});

function editUser(id: number) {
  const activeUserStore = useActiveUserStore();
  activeUserStore.loadUserFromId(id);  

  navigateTo(`/admin/users/edit/${id}/account/data`);
}
function personateUser(id: number) {
  // Implement navigation or API call to nullify
  alert(`Acceder como usuario ${id}`);
}
function deleteUser(id: number) {
  // Implement navigation or API call to delete
  alert(`Eliminar usuario ${id}`);
}
function consentUser(id: number) {
  // Implement navigation or API call to consent
  alert(`Consentir usuario ${id}`);
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" class="w-8 h-8 p-0">
        <span class="sr-only">Open menu</span>
        <MoreHorizontal class="w-4 h-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuLabel>Acciones</DropdownMenuLabel>
      <DropdownMenuItem @click="editUser(user.id)">Editar</DropdownMenuItem>
      <DropdownMenuItem @click="personateUser(user.id)">Acceder como</DropdownMenuItem>
      <DropdownMenuItem @click="deleteUser(user.id)">Eliminar</DropdownMenuItem>
      <DropdownMenuItem v-if="showConsentOption" @click="consentUser(user.id)">Aceptar consentimiento</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
