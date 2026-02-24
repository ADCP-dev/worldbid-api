<script setup lang="ts">
import { useTranslations } from '../../../../composables/useTranslations';
import { ref, onMounted } from 'vue';
import DeleteButton from '@/modules/ui-app/components/data-table/buttons/DeleteButton.vue';
import { Pencil } from 'lucide-vue-next';
import FormInput from '~/modules/ui-app/components/form/FormInput.vue'
import FormSwitch from '~/modules/ui-app/components/form/FormSwitch.vue'

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

const handleToggle = async (lang: any, isActive: boolean) => {
  lang.isActive = isActive;
  try {
    await updateLang(lang.id, { isActive });
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
  <div class="p-1 md:p-6">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">Languages</h1>
      <button class="btn btn-primary" @click="isDialogOpen = true">Add Language</button>

      <!-- Add Dialog -->
      <dialog class="modal" :class="{'modal-open': isDialogOpen}">
        <div class="modal-box">
          <h3 class="font-bold text-lg mb-4">Add Language</h3>
          <div class="flex flex-col gap-4 py-4">
            <FormInput v-model="newLang.code" label="Code" placeholder="en" required />
            <FormInput v-model="newLang.flagCode" label="Flag Code" placeholder="gb" required />
            <FormInput v-model="newLang.name" label="Name" placeholder="English" required />

            <FormSwitch v-model="newLang.isActive" label="Active" />
          </div>
          <div class="modal-action">
            <button class="btn btn-ghost" @click="isDialogOpen = false">Cancel</button>
            <button class="btn btn-primary" @click="handleCreate">Save</button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop" @click="isDialogOpen = false">
          <button>close</button>
        </form>
      </dialog>
    </div>

    <div class="overflow-x-auto bg-base-100 rounded-box border ">
      <table class="table table-zebra w-full">
        <thead>
          <tr class="bg-base-200">
            <th>Flag</th>
            <th>Code</th>
            <th>Name</th>
            <th>Active</th>
            <th class="w-[100px]">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="lang in langs" :key="lang.id">
            <td>
              <FlagIcon :code="lang.flagCode || lang.code" squared class="text-xl" />
            </td>
            <td class="font-medium">{{ lang.code }}</td>
            <td>{{ lang.name }}</td>
            <td>
              <input type="checkbox" class="toggle toggle-primary toggle-sm" :checked="lang.isActive" @change="handleToggle(lang, ($event.target as HTMLInputElement).checked)" />
            </td>
            <td>
              <div class="flex items-center gap-2">
                <button class="btn btn-ghost btn-sm btn-square" @click="openEditDialog(lang)">
                  <Pencil class="h-4 w-4" />
                </button>
                <DeleteButton @click="handleDelete(lang.id)" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Edit Dialog -->
    <dialog class="modal" :class="{'modal-open': isEditDialogOpen}">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Edit Language</h3>
        <div class="flex flex-col gap-4 py-4" v-if="editingLang">
          <FormInput v-model="editingLang.code" label="Code" placeholder="en" required />
          <FormInput v-model="editingLang.flagCode" label="Flag Code" placeholder="gb" required />
          <FormInput v-model="editingLang.name" label="Name" placeholder="English" required />

          <FormSwitch v-model="editingLang.isActive" label="Active" />
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="isEditDialogOpen = false; editingLang = null">Cancel</button>
          <button class="btn btn-primary" @click="handleEditSubmit">Update</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="isEditDialogOpen = false; editingLang = null">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>
