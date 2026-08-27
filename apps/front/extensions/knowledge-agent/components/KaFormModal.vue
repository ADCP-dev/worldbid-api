<script setup lang="ts">
import { ref, watch } from 'vue';
import { X } from 'lucide-vue-next';

/**
 * KaFormModal — generic form modal wrapping the native <dialog> element.
 * DaisyUI modal utilities + focus trap from the browser. No extra deps.
 *
 * Props:
 *   title — heading text (translated by caller)
 *   modelValue — boolean v-model for open state
 *   loading — disables submit button + shows spinner on it
 *   submitLabel — text of the submit button (translated by caller)
 *
 * Slots:
 *   default — form body (fields)
 *   footer — optional custom actions; falls back to Cancel / Submit
 *
 * Emits:
 *   submit — fired when the user clicks Submit; caller should close the
 *            modal via `v-model` on success.
 *   update:modelValue — standard v-model for open state.
 */
const props = defineProps<{
  modelValue: boolean;
  title: string;
  submitLabel?: string;
  loading?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  submit: [];
}>();

const { t } = useI18n();

const dialogRef = ref<HTMLDialogElement | null>(null);

watch(() => props.modelValue, (open) => {
  const dlg = dialogRef.value;
  if (!dlg) return;
  if (open && !dlg.open) dlg.showModal();
  if (!open && dlg.open) dlg.close();
});

function close(): void {
  emit('update:modelValue', false);
}
function onSubmit(): void {
  if (props.loading) return;
  emit('submit');
}
</script>

<template>
  <dialog ref="dialogRef" class="modal" @close="close">
    <div class="modal-box w-full max-w-lg">
      <form method="dialog">
        <button
          type="button"
          class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          :aria-label="t('ext.ka.settings.closeModal', 'Close')"
          @click="close"
        >
          <X :size="14" />
        </button>
      </form>
      <h3 class="font-bold text-lg mb-4">{{ title }}</h3>
      <div class="space-y-3">
        <slot />
      </div>
      <div class="modal-action">
        <slot name="footer">
          <button type="button" class="btn btn-ghost btn-sm" @click="close">
            {{ t('ext.ka.settings.cancel', 'Cancel') }}
          </button>
          <button
            type="button"
            class="btn btn-primary btn-sm gap-1"
            :disabled="loading"
            @click="onSubmit"
          >
            <span v-if="loading" class="loading loading-spinner loading-xs" />
            {{ submitLabel ?? t('ext.ka.settings.save', 'Save') }}
          </button>
        </slot>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="close" />
  </dialog>
</template>
