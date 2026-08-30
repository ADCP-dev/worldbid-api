<script setup lang="ts">
/**
 * TaskForm — single-page flat form for create/edit of a Task.
 *
 * All fields are visible at once (no stepper). Three sections separated by
 * headers: Basics, Assignment, Meta.
 *
 * Selects use native <select class="select select-bordered"> rather than the
 * custom FormSelect combobox, which was rendering a duplicate chevron and not
 * opening on click. Native selects are accessible and always work.
 *
 * Emits @submit(payload) with a TaskPayload. Parent handles the API call +
 * redirect.
 */
import { ref, shallowRef, watch } from 'vue';
import { toast } from 'vue-sonner';
import { Check } from 'lucide-vue-next';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue';
import FormDate from '@base/ui-app/components/form/FormDate.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';
import FormPassword from '@base/ui-app/components/form/FormPassword.vue';
import FormFile from '@base/ui-app/components/form/FormFile.vue';
import KeyValueEditor from '@base/ui-app/components/form/KeyValueEditor.vue';
import { CalendarDate } from '@internationalized/date';
import type { DateValue } from '@internationalized/date';
import type { Task, TaskPayload, TaskStatus, TaskPriority, UserLight } from '../types';
import { TASK_STATUSES, TASK_PRIORITIES } from '../types';

const props = defineProps<{
  task?: Task | null;
  users?: UserLight[];
  saving?: boolean;
  initialStatus?: string;
}>();

const emit = defineEmits<{
  (e: 'submit', payload: TaskPayload): void;
  (e: 'cancel'): void;
}>();

// ─── Form state ───────────────────────────────────────────────────────
// dueDate is a shallowRef: vue's deep ref() UnwrapRef mangles the
// DateValue class union and breaks the FormDate v-model type.
const dueDate = shallowRef<DateValue | null>(null);

const form = ref({
  title: '',
  description: '',
  status: 'pending' as TaskStatus,
  priority: 'medium' as TaskPriority,
  assigneeId: '' as string | number,
  reporterId: '' as string | number,
  position: 0,
  estimateHours: '' as string | number,
  isRecurring: false,
  recurrenceRule: '',
  metadata: {} as Record<string, unknown>,
  apiKey: '',
});

// File fields kept separately (File objects, not serialized to JSON)
const attachmentFile = ref<File | null>(null);
const coverImageFile = ref<File | null>(null);

// Load existing task into form (for edit mode)
watch(
  () => props.task,
  (t) => {
    if (!t) return;
    let due: DateValue | null = null;
    if (t.dueDate) {
      const d = new Date(t.dueDate);
      due = new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
    }
    dueDate.value = due;
    form.value = {
      title: t.title || '',
      description: t.description || '',
      status: (t.status || 'pending') as TaskStatus,
      priority: (t.priority || 'medium') as TaskPriority,
      assigneeId: t.assigneeId ?? '',
      reporterId: t.reporterId ?? '',
      position: t.position ?? 0,
      estimateHours: t.estimateHours ?? '',
      isRecurring: !!t.isRecurring,
      recurrenceRule: t.recurrenceRule || '',
      metadata: (t.metadata as Record<string, unknown>) || {},
      apiKey: '',
    };
  },
  { immediate: true },
);

// Apply initialStatus for new-task-with-preset-status flow (kanban "+")
if (!props.task && props.initialStatus) {
  form.value.status = props.initialStatus as TaskStatus;
}

// ─── Options ──────────────────────────────────────────────────────────
const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = TASK_STATUSES.map((s) => ({
  value: s,
  label: s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1),
}));

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = TASK_PRIORITIES.map((p) => ({
  value: p,
  label: p.charAt(0).toUpperCase() + p.slice(1),
}));

// ─── Validation ───────────────────────────────────────────────────────
const errors = ref<Record<string, string>>({});

function validate(): boolean {
  errors.value = {};
  if (!form.value.title.trim()) errors.value.title = 'Title is required';
  else if (form.value.title.trim().length < 2) errors.value.title = 'Min 2 characters';
  if (!form.value.status) errors.value.status = 'Status is required';
  if (!form.value.priority) errors.value.priority = 'Priority is required';
  return Object.keys(errors.value).length === 0;
}

function buildPayload(): TaskPayload {
  const due = dueDate.value;
  const dueStr = due
    ? `${(due as CalendarDate).year}-${String((due as CalendarDate).month).padStart(2, '0')}-${String((due as CalendarDate).day).padStart(2, '0')}T00:00:00.000Z`
    : null;

  return {
    title: form.value.title.trim(),
    description: form.value.description.trim() || null,
    status: form.value.status,
    priority: form.value.priority,
    assigneeId: form.value.assigneeId === '' ? null : Number(form.value.assigneeId),
    reporterId: form.value.reporterId === '' ? null : Number(form.value.reporterId),
    dueDate: dueStr,
    position: Number(form.value.position) || 0,
    estimateHours: form.value.estimateHours === '' ? null : Number(form.value.estimateHours),
    isRecurring: !!form.value.isRecurring,
    recurrenceRule: form.value.isRecurring ? form.value.recurrenceRule.trim() || null : null,
    metadata: Object.keys(form.value.metadata).length ? form.value.metadata : null,
    apiKey: form.value.apiKey.trim() || null,
    // attachment & coverImage are File objects — backend expects string paths
    // on update; for create they require multipart. Best-effort name pass.
    attachment: attachmentFile.value ? attachmentFile.value.name : null,
    coverImage: coverImageFile.value ? coverImageFile.value.name : null,
  };
}

function submit() {
  if (!validate()) {
    toast.error('Please fix the errors before submitting');
    return;
  }
  emit('submit', buildPayload());
}
</script>

<template>
  <div class="space-y-6">
    <!-- ─── Section: Basics ────────────────────────────────────── -->
    <section class="space-y-4">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-base-content/60 pb-1 border-b border-base-300">
        Basics
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="md:col-span-2">
          <FormInput
            v-model="form.title"
            label="Title"
            required
            placeholder="e.g. Refactor auth module"
            :error="errors.title"
          />
        </div>
        <div class="md:col-span-2">
          <FormTextArea
            v-model="form.description"
            label="Description"
            :rows="4"
            placeholder="Add context, acceptance criteria, links…"
          />
        </div>

        <!-- Status — native select -->
        <div class="form-control w-full">
          <label class="label">
            <span class="label-text font-semibold">
              Status<span class="text-error ml-1">*</span>
            </span>
          </label>
          <select v-model="form.status" class="select select-bordered w-full">
            <option v-for="opt in STATUS_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <label v-if="errors.status" class="label py-0">
            <span class="label-text-alt text-error font-medium">{{ errors.status }}</span>
          </label>
        </div>

        <!-- Priority — native select -->
        <div class="form-control w-full">
          <label class="label">
            <span class="label-text font-semibold">
              Priority<span class="text-error ml-1">*</span>
            </span>
          </label>
          <select v-model="form.priority" class="select select-bordered w-full">
            <option v-for="opt in PRIORITY_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <label v-if="errors.priority" class="label py-0">
            <span class="label-text-alt text-error font-medium">{{ errors.priority }}</span>
          </label>
        </div>
      </div>
    </section>

    <!-- ─── Section: Assignment ────────────────────────────────── -->
    <section class="space-y-4">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-base-content/60 pb-1 border-b border-base-300">
        Assignment
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Assignee — native select -->
        <div class="form-control w-full">
          <label class="label">
            <span class="label-text font-semibold">Assignee</span>
          </label>
          <select v-model="form.assigneeId" class="select select-bordered w-full">
            <option value="">Unassigned</option>
            <option
              v-for="u in (props.users ?? [])"
              :key="u.id"
              :value="u.id"
            >{{ u.firstName }} {{ u.lastName }}</option>
          </select>
        </div>

        <!-- Reporter — native select -->
        <div class="form-control w-full">
          <label class="label">
            <span class="label-text font-semibold">Reporter</span>
          </label>
          <select v-model="form.reporterId" class="select select-bordered w-full">
            <option value="">Unassigned</option>
            <option
              v-for="u in (props.users ?? [])"
              :key="u.id"
              :value="u.id"
            >{{ u.firstName }} {{ u.lastName }}</option>
          </select>
        </div>

        <FormDate
          v-model="dueDate"
          label="Due date"
          placeholder="Pick a due date"
        />
        <FormInput
          v-model="form.position"
          label="Position (order in column)"
          type="number"
          min="0"
        />
        <FormInput
          v-model="form.estimateHours"
          label="Estimate (hours)"
          type="number"
          step="0.5"
          placeholder="8.5"
        />
      </div>
    </section>

    <!-- ─── Section: Meta ──────────────────────────────────────── -->
    <section class="space-y-4">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-base-content/60 pb-1 border-b border-base-300">
        Meta
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="md:col-span-2">
          <FormSwitch
            v-model="form.isRecurring"
            label="Recurring"
            description="Does this task repeat on a schedule?"
          />
        </div>
        <div v-if="form.isRecurring" class="md:col-span-2">
          <FormInput
            v-model="form.recurrenceRule"
            label="Recurrence rule (iCalendar RFC 5545)"
            placeholder="FREQ=WEEKLY;BYDAY=MO,FR"
          />
        </div>
        <div class="md:col-span-2">
          <KeyValueEditor
            :model-value="form.metadata"
            label="Metadata (key/value)"
            @update:model-value="(v: Record<string, unknown>) => (form.metadata = v)"
          />
        </div>
        <FormPassword
          v-model="form.apiKey"
          label="API key (integration token)"
          placeholder="Secret token"
          description="Stored masked; never returned in full by the API."
        />
        <FormFile
          :model-value="attachmentFile"
          label="Attachment"
          accept=".pdf,.txt"
          description="A single supporting document (PDF/TXT)."
          @update:modelValue="(v: File | null) => (attachmentFile = v)"
        />
        <FormFile
          :model-value="coverImageFile"
          label="Cover image"
          accept="image/*"
          description="One cover image (PNG/JPEG/WebP)."
          @update:modelValue="(v: File | null) => (coverImageFile = v)"
        />
      </div>
    </section>

    <!-- Actions -->
    <div class="flex items-center justify-end gap-2 pt-4 border-t border-base-300">
      <button class="btn btn-ghost" :disabled="saving" @click="emit('cancel')">
        Cancel
      </button>
      <button class="btn btn-primary" :disabled="saving" @click="submit">
        <span v-if="saving" class="loading loading-spinner loading-xs" />
        <Check v-else class="w-4 h-4" />
        {{ task ? 'Save' : 'Create task' }}
      </button>
    </div>
  </div>
</template>