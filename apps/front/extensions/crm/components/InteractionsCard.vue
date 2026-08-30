<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { Plus } from 'lucide-vue-next';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue';
import EditButton from '@base/ui-app/components/data-table/buttons/EditButton.vue';
import DeleteButton from '@base/ui-app/components/data-table/buttons/DeleteButton.vue';
import {
  useInteractionsQuery,
  useContactsQuery,
  useCreateInteractionMutation,
  useUpdateInteractionMutation,
  useDeleteInteractionMutation,
  crmAsList,
} from '@crm/composables/useCrm';
import type { Interaction, InteractionPayload, InteractionType } from '../types';

const props = defineProps<{ clientId: number }>();
const { t, d } = useI18n();

const { data: interactionsData, isLoading } = useInteractionsQuery(() => props.clientId);
const interactions = computed<Interaction[]>(() => crmAsList<Interaction>(interactionsData.value ?? []));
const { data: contacts } = useContactsQuery(() => props.clientId);

const createMut = useCreateInteractionMutation();
const updateMut = useUpdateInteractionMutation();
const deleteMut = useDeleteInteractionMutation();

const showModal = ref(false);
const editingId = ref<number | null>(null);
const saving = ref(false);
const deleteTarget = ref<Interaction | null>(null);

const TYPE_OPTIONS = computed(() =>
  (['meeting', 'call', 'email', 'whatsapp', 'note', 'other'] as InteractionType[]).map((v) => ({
    value: v,
    label: t(`ext.crm.interactions.${v}`),
  })),
);

const contactOptions = computed(() =>
  (contacts.value ?? []).map((c) => ({ value: c.id, label: c.name })),
);

const emptyForm = () => ({
  type: 'meeting' as InteractionType,
  subject: '',
  body: '',
  interactionDate: new Date().toISOString().slice(0, 10),
  contactId: null as number | null,
});

const form = ref(emptyForm());

function openCreate() {
  editingId.value = null;
  form.value = emptyForm();
  showModal.value = true;
}

function openEdit(interaction: Interaction) {
  editingId.value = interaction.id;
  form.value = {
    type: (interaction.type as InteractionType) || 'meeting',
    subject: interaction.subject || '',
    body: interaction.body || '',
    interactionDate: interaction.interactionDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    contactId: interaction.contactId ?? null,
  };
  showModal.value = true;
}

async function submit() {
  saving.value = true;
  const payload: InteractionPayload = {
    type: form.value.type,
    subject: form.value.subject || undefined,
    body: form.value.body || undefined,
    interactionDate: form.value.interactionDate,
    contactId: form.value.contactId ?? undefined,
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

const TYPE_BADGE: Record<string, string> = {
  meeting: 'badge-primary',
  call: 'badge-info',
  email: 'badge-secondary',
  whatsapp: 'badge-success',
  note: 'badge-ghost',
  other: 'badge-outline',
};

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return d(new Date(value), { year: 'numeric', month: 'short', day: 'numeric' });
}
</script>

<template>
  <div class="card bg-base-100 shadow-sm border border-base-300">
    <div class="card-body">
      <div class="flex items-center justify-between">
        <h2 class="card-title text-base">{{ t('ext.crm.clients.interactions') }}</h2>
        <button class="btn btn-ghost btn-xs" @click="openCreate">
          <Plus class="w-3 h-3" /> {{ t('ext.crm.interactions.new') }}
        </button>
      </div>

      <div v-if="isLoading" class="flex justify-center py-6">
        <span class="loading loading-spinner loading-md text-primary" />
      </div>

      <div v-else-if="!interactions.length" class="py-6 text-center text-base-content/40 text-sm">
        {{ t('ext.crm.clients.noInteractions') }}
      </div>

      <ul v-else class="space-y-3 max-h-96 overflow-y-auto">
        <li
          v-for="i in interactions"
          :key="i.id"
          class="flex items-start justify-between gap-2 border-b border-base-200 pb-3 last:border-0"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="badge badge-xs" :class="TYPE_BADGE[i.type as string] ?? 'badge-outline'">
                {{ t(`ext.crm.interactions.${i.type}`, i.type) }}
              </span>
              <span class="text-xs text-base-content/50">{{ formatDate(i.interactionDate) }}</span>
            </div>
            <p v-if="i.subject" class="text-sm font-medium mt-1">{{ i.subject }}</p>
            <p v-if="i.body" class="text-xs text-base-content/60 truncate">{{ i.body }}</p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <EditButton @click="openEdit(i)" />
            <DeleteButton @click="deleteTarget = i" />
          </div>
        </li>
      </ul>
    </div>
  </div>

  <!-- Create/Edit modal -->
  <dialog v-if="showModal" class="modal modal-open">
    <div class="modal-box">
      <h3 class="text-lg font-bold">
        {{ editingId ? t('ext.crm.interactions.editTitle') : t('ext.crm.interactions.new') }}
      </h3>
      <div class="py-4 space-y-4">
        <FormSelect v-model="form.type" :label="t('ext.crm.interactions.type')" :options="TYPE_OPTIONS" />
        <FormInput v-model="form.subject" :label="t('ext.crm.interactions.subject')" />
        <FormTextArea v-model="form.body" :label="t('ext.crm.interactions.body')" :rows="3" />
        <FormInput
          v-model="form.interactionDate"
          :label="t('ext.crm.interactions.date')"
          type="date"
        />
        <FormSelect
          v-model="form.contactId"
          :label="t('ext.crm.interactions.contact')"
          :options="contactOptions"
        />
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
      <p class="py-4">{{ t('ext.crm.common.deleteWarning') }}</p>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="deleteTarget = null">{{ t('ext.crm.common.cancel') }}</button>
        <button class="btn btn-error" @click="confirmDelete">{{ t('ext.crm.common.delete') }}</button>
      </div>
    </div>
    <div class="modal-backdrop" @click="deleteTarget = null" />
  </dialog>
</template>