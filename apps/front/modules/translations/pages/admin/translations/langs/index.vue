<script setup lang="ts">
import { useTranslations } from '../../../../composables/useTranslations';
import { ref, onMounted } from 'vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

const { getLangs, createLang, updateLang, deleteLang } = useTranslations();

const langs = ref<any[]>([]);
const newLang = ref({ code: '', name: '', isActive: true });
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
    newLang.value = { code: '', name: '', isActive: true };
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
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Active</TableHead>
            <TableHead class="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="lang in langs" :key="lang.id">
            <TableCell class="font-medium">{{ lang.code }}</TableCell>
            <TableCell>{{ lang.name }}</TableCell>
            <TableCell>
              <Switch v-model="lang.isActive" @update:model-value="handleToggle(lang, { isActive: $event })" />
            </TableCell>
            <TableCell>
              <Button variant="destructive" size="sm" @click="handleDelete(lang.id)">Delete</Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
