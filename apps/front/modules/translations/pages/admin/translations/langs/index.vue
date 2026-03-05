<script setup lang="ts">
import { useTranslations } from '../../../../composables/useTranslations';
import { ref, onMounted } from 'vue';
import DeleteButton from '@/modules/ui-app/components/data-table/buttons/DeleteButton.vue';
import { Pencil } from 'lucide-vue-next';
import FormInput from '~/modules/ui-app/components/form/FormInput.vue'
import FormSwitch from '~/modules/ui-app/components/form/FormSwitch.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

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
  if (confirm(t('base.languages.confirmDelete'))) {
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
      <h1 class="text-2xl font-bold">{{ $t('base.languages.title') }}</h1>
      <button class="btn btn-primary" @click="isDialogOpen = true">{{ $t('base.languages.addLanguageBtn') }}</button>

      <!-- Add Dialog -->
      <dialog class="modal" :class="{'modal-open': isDialogOpen}">
        <div class="modal-box">
          <h3 class="font-bold text-lg mb-4">{{ $t('base.languages.addLanguageDialogTitle') }}</h3>
          <div class="flex flex-col gap-4 py-4">
            <FormInput v-model="newLang.code" :label="$t('base.languages.code')" placeholder="en" required />
            <FormInput v-model="newLang.flagCode" :label="$t('base.languages.flagCode')" placeholder="gb" required />
            <FormInput v-model="newLang.name" :label="$t('base.languages.name')" placeholder="English" required />

            <FormSwitch v-model="newLang.isActive" :label="$t('base.languages.active')" />
          </div>
          <div class="modal-action">
            <button class="btn btn-ghost" @click="isDialogOpen = false">{{ $t('base.languages.cancelBtn') }}</button>
            <button class="btn btn-primary" @click="handleCreate">{{ $t('base.languages.saveBtn') }}</button>
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
            <th>{{ $t('base.languages.tableFlag') }}</th>
            <th>{{ $t('base.languages.tableCode') }}</th>
            <th>{{ $t('base.languages.tableName') }}</th>
            <th>{{ $t('base.languages.tableActive') }}</th>
            <th class="w-[100px]">{{ $t('base.languages.tableActions') }}</th>
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
        <h3 class="font-bold text-lg mb-4">{{ $t('app.languages.editLanguageDialogTitle') }}</h3>
        <div class="flex flex-col gap-4 py-4" v-if="editingLang">
          <FormInput v-model="editingLang.code" :label="$t('app.languages.code')" placeholder="en" required />
          <FormInput v-model="editingLang.flagCode" :label="$t('app.languages.flagCode')" placeholder="gb" required />
          <FormInput v-model="editingLang.name" :label="$t('app.languages.name')" placeholder="English" required />

          <FormSwitch v-model="editingLang.isActive" :label="$t('app.languages.active')" />
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="isEditDialogOpen = false; editingLang = null">{{ $t('base.languages.cancelBtn') }}</button>
          <button class="btn btn-primary" @click="handleEditSubmit">{{ $t('base.languages.updateBtn') }}</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="isEditDialogOpen = false; editingLang = null">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>
