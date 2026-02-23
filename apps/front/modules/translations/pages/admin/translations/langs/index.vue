<script setup lang="ts">
import { useTranslations } from '../../../../composables/useTranslations';
import { ref, onMounted } from 'vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import DeleteButton from '@/modules/ui-app/components/data-table/buttons/DeleteButton.vue';
import { Pencil } from 'lucide-vue-next';

const { getLangs, createLang, updateLang, deleteLang } = useTranslations();

const langs = ref<any[]>([]);
const newLang = ref({ code: '', name: '', isActive: true, flagCode: '' });
const isDialogOpen = ref(false);

const fetchLangs = async () => {
  try {
    const data = await getLangs();
    langs.value = data;
  } catch (error) {
    console.error(error);
  }
};

const handleCreate = async () => {
  try {
    await createLang(newLang.value);
    isDialogOpen.value = false;
    newLang.value = { code: '', name: '', isActive: true, flagCode: '' };
    fetchLangs();
  } catch (error) {
    console.error(error);
  }
};

const handleToggle = async (lang: any, updates: any) => {
  try {
    await updateLang(lang.id, updates);
    fetchLangs();
  } catch (error) {
    console.error(error);
  }
};

const isEditDialogOpen = ref(false);
const editingLang = ref<any>(null);

const openEditDialog = (lang: any) => {
  editingLang.value = { ...lang };
  isEditDialogOpen.value = true;
};

const handleEditSubmit = async () => {
  try {
    await updateLang(editingLang.value.id, {
      code: editingLang.value.code,
      name: editingLang.value.name,
      flagCode: editingLang.value.flagCode,
      isActive: editingLang.value.isActive,
    });
    isEditDialogOpen.value = false;
    editingLang.value = null;
    fetchLangs();
  } catch (error) {
    console.error(error);
  }
};

const handleDelete = async (id: number) => {
  if (confirm('Are you sure?')) {
    try {
      await deleteLang(id);
      fetchLangs();
    } catch (error) {
      console.error(error);
    }
  }
};

onMounted(fetchLangs);
</script>

<template>
  <div class="p-6">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">Languages</h1>
      <Dialog v-model:open="isDialogOpen">
        <DialogTrigger as-child>
          <Button>Add Language</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Language</DialogTitle>
          </DialogHeader>
          <div class="grid gap-4 py-4">
            <div class="grid grid-cols-4 items-center gap-4">
              <label class="text-right">Code</label>
              <Input v-model="newLang.code" class="col-span-3" placeholder="en" />
            </div>
            <div class="grid grid-cols-4 items-center gap-4">
              <label class="text-right">Flag Code</label>
              <Input v-model="newLang.flagCode" class="col-span-3" placeholder="gb" />
            </div>
            <div class="grid grid-cols-4 items-center gap-4">
              <label class="text-right">Name</label>
              <Input v-model="newLang.name" class="col-span-3" placeholder="English" />
            </div>
            <div class="grid grid-cols-4 items-center gap-4">
              <label class="text-right">Active</label>
              <Switch v-model="newLang.isActive" />
            </div>
          </div>
          <Button @click="handleCreate">Save</Button>
        </DialogContent>
      </Dialog>
    </div>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Flag</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Active</TableHead>
            <TableHead class="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="lang in langs" :key="lang.id">
            <TableCell>
              <FlagIcon :code="lang.flagCode || lang.code" squared class="text-xl" />
            </TableCell>
            <TableCell class="font-medium">{{ lang.code }}</TableCell>
            <TableCell>{{ lang.name }}</TableCell>
            <TableCell>
              <Switch v-model="lang.isActive" @update:model-value="handleToggle(lang, { isActive: $event })" />
            </TableCell>
            <TableCell class="flex items-center gap-2">
              <Button variant="outline" size="sm" class="h-8 w-8 p-0" @click="openEditDialog(lang)">
                <Pencil class="h-4 w-4" />
              </Button>
              <DeleteButton @click="handleDelete(lang.id)" />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Edit Dialog -->
    <Dialog v-model:open="isEditDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Language</DialogTitle>
        </DialogHeader>
        <div class="grid gap-4 py-4" v-if="editingLang">
          <div class="grid grid-cols-4 items-center gap-4">
            <label class="text-right">Code</label>
            <Input v-model="editingLang.code" class="col-span-3" />
          </div>
          <div class="grid grid-cols-4 items-center gap-4">
            <label class="text-right">Flag Code</label>
            <Input v-model="editingLang.flagCode" class="col-span-3" />
          </div>
          <div class="grid grid-cols-4 items-center gap-4">
            <label class="text-right">Name</label>
            <Input v-model="editingLang.name" class="col-span-3" />
          </div>
          <div class="grid grid-cols-4 items-center gap-4">
            <label class="text-right">Active</label>
            <Switch v-model="editingLang.isActive" />
          </div>
        </div>
        <Button @click="handleEditSubmit">Update</Button>
      </DialogContent>
    </Dialog>
  </div>
</template>
