<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { Plus } from 'lucide-vue-next';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';
import EditButton from '@base/ui-app/components/data-table/buttons/EditButton.vue';
import DeleteButton from '@base/ui-app/components/data-table/buttons/DeleteButton.vue';
import {
  useContactsQuery,
  useCreateContactMutation,
  useUpdateContactMutation,
  useDeleteContactMutation,
  crmAsList,
} from '../composables/useCrm';
import type { Contact, ContactPayload } from '../types';

const props = defineProps<{ clientId: number }>();
const { t } = useI18n();

const { data: contactsData, isLoading } = useContactsQuery(() => props.clientId);
const contacts = computed<Contact[]>(() => crmAsList<Contact>(contactsData.value ?? []));

const createMut = useCreateContactMutation();
const updateMut = useUpdateContactMutation();
const deleteMut = useDeleteContactMutation();

const showModal = ref(false);
const editingId = ref<number | null>(null);
const saving = ref(false);
const deleteTarget = ref<Contact | null>(null);

const emptyForm = () => ({
  name: '',
  role: '',
  email: '',
  phone: '',
  isPrimary: false,
});

const form = ref(emptyForm());

function openCreate() {
  editingId.value = null;
  form.value = emptyForm();
  showModal.value = true;
}

function openEdit(contact: Contact) {
  editingId.value = contact.id;
  form.value = {
    name: contact.name || '',
    role: contact.role || '',
    email: contact.email || '',
    phone: contact.phone || '',
    isPrimary: contact.isPrimary,
  };
  showModal.value = true;
}

async function submit() {
  if (!form.value.name.trim()) return;
  saving.value = true;
  const payload: ContactPayload = {
    name: form.value.name.trim(),
    role: form.value.role || undefined,
    email: form.value.email || undefined,
    phone: form.value.phone || undefined,
    isPrimary: form.value.isPrimary,
  };
  try {
    if (editingId.value) {
      await updateMut.mutateAsync({ clientId: props.clientId, id: editingId.value, data: payload });
      toast.success(t('ext.crm.common.saved'));
    } else {
      await createMut.mutateAsync({ clientId: props.clientId, data: payload });
      toast.success(t('ext.crm.common.created'));
    }
    showModal.value = false;
  } catch (err: unknown) {
    toast.error(t('ext.crm.common.error'), { description: errorMessage(err) });
  } finally {
    saving.value = false;
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  try {
    await deleteMut.mutateAsync({ clientId: props.clientId, id: deleteTarget.value.id });
    toast.success(t('ext.crm.common.deleted'));
    deleteTarget.value = null;
  } catch (err: unknown) {
    toast.error(t('ext.crm.common.error'), { description: errorMessage(err) });
  }
}
</script>

<template>
  <div class="card bg-base-100 shadow-sm border border-base-300">
    <div class="card-body">
      <div class="flex items-center justify-between">
        <h2 class="card-title text-base">{{ t('ext.crm.clients.contacts') }}</h2>
        <button class="btn btn-ghost btn-xs" @click="openCreate">
          <Plus class="w-3 h-3" /> {{ t('ext.crm.contacts.new') }}
        </button>
      </div>

      <div v-if="isLoading" class="flex justify-center py-6">
        <span class="loading loading-spinner loading-md text-primary" />
      </div>

      <div v-else-if="!contacts.length" class="py-6 text-center text-base-content/40 text-sm">
        {{ t('ext.crm.clients.noContacts') }}
      </div>

      <div v-else class="overflow-x-auto">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>{{ t('ext.crm.contacts.name') }}</th>
              <th>{{ t('ext.crm.contacts.role') }}</th>
              <th>{{ t('ext.crm.contacts.email') }}</th>
              <th>{{ t('ext.crm.contacts.phone') }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in contacts" :key="c.id">
              <td class="font-medium">
                {{ c.name }}
                <span v-if="c.isPrimary" class="badge badge-primary badge-xs ml-1">
                  {{ t('ext.crm.contacts.primary') }}
                </span>
              </td>
              <td>{{ c.role ?? '—' }}</td>
              <td>{{ c.email ?? '—' }}</td>
              <td>{{ c.phone ?? '—' }}</td>
              <td class="text-right">
                <div class="flex items-center justify-end gap-1">
                  <EditButton @click="openEdit(c)" />
                  <DeleteButton @click="deleteTarget = c" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Create/Edit modal -->
  <dialog v-if="showModal" class="modal modal-open">
    <div class="modal-box">
      <h3 class="text-lg font-bold">
        {{ editingId ? t('ext.crm.contacts.editTitle') : t('ext.crm.contacts.new') }}
      </h3>
      <div class="py-4 space-y-4">
        <FormInput v-model="form.name" :label="t('ext.crm.contacts.name')" required />
        <FormInput v-model="form.role" :label="t('ext.crm.contacts.role')" />
        <FormInput v-model="form.email" :label="t('ext.crm.contacts.email')" type="email" />
        <FormInput v-model="form.phone" :label="t('ext.crm.contacts.phone')" />
        <FormSwitch v-model="form.isPrimary" :label="t('ext.crm.contacts.primary')" />
      </div>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="showModal = false">{{ t('ext.crm.common.cancel') }}</button>
        <button class="btn btn-primary" :disabled="saving" @click="submit">
          <span v-if="saving" class="loading loading-spinner loading-xs" />
          {{ editingId ? t('ext.crm.common.save') : t('ext.crm.common.create') }}
        </button>
      </div>
    </div>
    <div class="modal-backdrop" @click="showModal = false" />
  </dialog>

  <!-- Delete confirm -->
  <dialog v-if="deleteTarget" class="modal modal-open">
    <div class="modal-box">
      <h3 class="text-lg font-bold">{{ t('ext.crm.common.confirmDeleteTitle') }}</h3>
      <p class="py-4">
        <strong>{{ deleteTarget.name }}</strong> — {{ t('ext.crm.common.deleteWarning') }}
      </p>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="deleteTarget = null">{{ t('ext.crm.common.cancel') }}</button>
        <button class="btn btn-error" @click="confirmDelete">{{ t('ext.crm.common.delete') }}</button>
      </div>
    </div>
    <div class="modal-backdrop" @click="deleteTarget = null" />
  </dialog>
</template>