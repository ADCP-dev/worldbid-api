<script setup lang="ts">
import { useTranslations } from '../../../composables/useTranslations';
import { ref, onMounted, watch } from 'vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const { getLangs, getTranslations, createTranslation, updateTranslation, deleteTranslation, generateJson } = useTranslations();

const langs = ref<any[]>([]);
const translations = ref<any[]>([]);
const filters = ref({ section: '', langId: '', entityName: '', entityId: '' });
const newTranslation = ref({ section: '', key: '', content: '', langId: '', entityName: '', entityId: '' });
const isDialogOpen = ref(false);
const isGenerating = ref(false);

const fetchLangs = async () => {
  langs.value = await getLangs();
};

const fetchTranslations = async () => {
  translations.value = await getTranslations(filters.value);
};

const handleCreate = async () => {
  try {
    await createTranslation({
      ...newTranslation.value,
      langId: parseInt(newTranslation.value.langId as string),
    });
    isDialogOpen.value = false;
    newTranslation.value = { section: '', key: '', content: '', langId: '', entityName: '', entityId: '' };
    fetchTranslations();
  } catch (error) {
    console.error(error);
  }
};

const handleDelete = async (id: number) => {
  if (confirm('Are you sure?')) {
    await deleteTranslation(id);
    fetchTranslations();
  }
};

const handleGenerate = async () => {
  isGenerating.value = true;
  try {
    await generateJson();
    alert('Generated successfully!');
  } catch (error) {
    console.error(error);
    alert('Failed to generate');
  } finally {
    isGenerating.value = false;
  }
};

watch(filters, fetchTranslations, { deep: true });

onMounted(() => {
  fetchLangs();
  fetchTranslations();
});
</script>

<template>
  <div class="p-6">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">Translations</h1>
      <div class="flex gap-2">
        <Button variant="outline" @click="handleGenerate" :disabled="isGenerating">
          {{ isGenerating ? 'Generating...' : 'Generate JSON' }}
        </Button>
        <Dialog v-model:open="isDialogOpen">
          <DialogTrigger as-child>
            <Button>Add Translation</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Translation</DialogTitle>
            </DialogHeader>
            <div class="grid gap-4 py-4">
              <div class="grid grid-cols-4 items-center gap-4">
                <label class="text-right">Lang</label>
                <select v-model="newTranslation.langId" class="col-span-3 border p-2 rounded">
                   <option v-for="lang in langs" :key="lang.id" :value="lang.id">{{ lang.name }}</option>
                </select>
              </div>
              <div class="grid grid-cols-4 items-center gap-4">
                <label class="text-right">Section</label>
                <Input v-model="newTranslation.section" class="col-span-3" placeholder="page.home" />
              </div>
              <div class="grid grid-cols-4 items-center gap-4">
                <label class="text-right">Key</label>
                <Input v-model="newTranslation.key" class="col-span-3" placeholder="title" />
              </div>
              <div class="grid grid-cols-4 items-center gap-4">
                <label class="text-right">Content</label>
                <Input v-model="newTranslation.content" class="col-span-3" />
              </div>
              <div class="grid grid-cols-4 items-center gap-4">
                <label class="text-right">Entity Name</label>
                <Input v-model="newTranslation.entityName" class="col-span-3" placeholder="Optional" />
              </div>
              <div class="grid grid-cols-4 items-center gap-4">
                <label class="text-right">Entity ID</label>
                <Input v-model="newTranslation.entityId" class="col-span-3" placeholder="Optional" />
              </div>
            </div>
            <Button @click="handleCreate">Save</Button>
          </DialogContent>
        </Dialog>
      </div>
    </div>

    <div class="flex gap-4 mb-4">
      <Input v-model="filters.section" placeholder="Filter by Section" />
      <select v-model="filters.langId" class="border p-2 rounded">
        <option value="">All Langs</option>
        <option v-for="lang in langs" :key="lang.id" :value="lang.id">{{ lang.name }}</option>
      </select>
      <Input v-model="filters.entityName" placeholder="Entity Name" />
      <Input v-model="filters.entityId" placeholder="Entity ID" />
    </div>

    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lang</TableHead>
          <TableHead>Section</TableHead>
          <TableHead>Key</TableHead>
          <TableHead>Content</TableHead>
          <TableHead>Entity</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="t in translations" :key="t.id">
          <TableCell>{{ t.lang?.code }}</TableCell>
          <TableCell>{{ t.section }}</TableCell>
          <TableCell>{{ t.key }}</TableCell>
          <TableCell>{{ t.content }}</TableCell>
          <TableCell>
            <span v-if="t.entityName">{{ t.entityName }}:{{ t.entityId }}</span>
            <span v-else>-</span>
          </TableCell>
          <TableCell>
             <Button variant="destructive" size="sm" @click="handleDelete(t.id)">Delete</Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
