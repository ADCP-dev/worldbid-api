<script setup lang="ts">
/**
 * TaskForm — 3-step stepper form for create/edit of a Task.
 *
 * Step 1 "What":  title, description, status, priority
 * Step 2 "Who & When": assignee, reporter, dueDate, position, estimateHours
 * Step 3 "Meta": isRecurring, recurrenceRule (showIf), metadata, apiKey, attachment, coverImage
 *
 * Uses base UI components from @base/ui-app/components/form/.
 * Emits @submit(payload) with a TaskPayload. Parent handles API call + redirect.
 */
import { ref, computed, watch } from 'vue';
import { toast } from 'vue-sonner';
import { ChevronLeft, ChevronRight, Check, FileText, Users, Settings } from 'lucide-vue-next';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import FormSearchSelect from '@base/ui-app/components/form/FormSearchSelect.vue';
import FormDate from '@base/ui-app/components/form/FormDate.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';
import FormPassword from '@base/ui-app/components/form/FormPassword.vue';
import FormFile from '@base/ui-app/components/form/FormFile.vue';
import KeyValueEditor from '@base/ui-app/components/form/KeyValueEditor.vue';
import type { CalendarDate, DateValue } from '@internationalized/date';
import type { Task, TaskPayload, UserLight } from '../types';
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

const STEPS = [
  { id: 'what', title: 'What', icon: FileText },
  { id: 'who-when', title: 'Who & When', icon: Users },
  { id: 'meta', title: 'Meta', icon: Settings },
];

const currentStep = ref(0);

// ─── Form state ───────────────────────────────────────────────────────
const form = ref({
  title: '',
  description: '',
  status: 'pending' as string,
  priority: 'medium' as string,
  assigneeId: '' as string | number,
  reporterId: '' as string | number,
  dueDate: null as DateValue | null,
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
    form.value = {
      title: t.title || '',
      description: t.description || '',
      status: t.status || 'pending',
      priority: t.priority || 'medium',
      assigneeId: t.assigneeId ?? '',
      reporterId: t.reporterId ?? '',
      dueDate: due,
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

// Apply initialStatus for new-task-with-preset-status flow (e.g. kanban "+" button)
if (!props.task && props.initialStatus) {
  form.value.status = props.initialStatus;
}

// ─── Options ──────────────────────────────────────────────────────────
const statusOptions = computed(() =>
  TASK_STATUSES.map((s) => ({
    value: s,
    label: s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1),
  })),
);

const priorityOptions = computed(() =>
  TASK_PRIORITIES.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) })),
);

const userOptions = computed(() => [
  { label: 'Unassigned', value: '' },
  ...(props.users ?? []).map((u) => ({
    label: `${u.firstName} ${u.lastName}`.trim(),
    value: u.id,
  })),
]);

// ─── Validation ───────────────────────────────────────────────────────
const errors = ref<Record<string, string>>({});

function validateStep(step: number): boolean {
  errors.value = {};
  if (step === 0) {
    if (!form.value.title.trim()) errors.value.title = 'Title is required';
    else if (form.value.title.trim().length < 2) errors.value.title = 'Min 2 characters';
    if (!form.value.status) errors.value.status = 'Status is required';
    if (!form.value.priority) errors.value.priority = 'Priority is required';
  }
  return Object.keys(errors.value).length === 0;
}

function next() {
  if (!validateStep(currentStep.value)) {
    toast.error('Please fix the errors before continuing');
    return;
  }
  if (currentStep.value < STEPS.length - 1) currentStep.value++;
}

function prev() {
  if (currentStep.value > 0) currentStep.value--;
}

function buildPayload(): TaskPayload {
  const due = form.value.dueDate;
  const dueStr = due
    ? `${(due as CalendarDate).year}-${String((due as CalendarDate).month).padStart(2, '0')}-${String((due as CalendarDate).day).padStart(2, '0')}T00:00:00.000Z`
    : null;

  return {
    title: form.value.title.trim(),
    description: form.value.description.trim() || null,
    status: form.value.status as TaskPayload['status'],
    priority: form.value.priority as TaskPayload['priority'],
    assigneeId: form.value.assigneeId === '' ? null : Number(form.value.assigneeId),
    reporterId: form.value.reporterId === '' ? null : Number(form.value.reporterId),
    dueDate: dueStr,
    position: Number(form.value.position) || 0,
    estimateHours: form.value.estimateHours === '' ? null : Number(form.value.estimateHours),
    isRecurring: !!form.value.isRecurring,
    recurrenceRule: form.value.isRecurring ? form.value.recurrenceRule.trim() || null : null,
    metadata: Object.keys(form.value.metadata).length ? form.value.metadata : null,
    apiKey: form.value.apiKey.trim() || null,
    // attachment & coverImage are File objects — backend expects string paths on
    // update; for create they require multipart. We pass through names as a
    // best-effort (backend hook resolves uploads separately).
    attachment: attachmentFile.value ? attachmentFile.value.name : null,
    coverImage: coverImageFile.value ? coverImageFile.value.name : null,
  };
}

function submit() {
  // Validate all steps before final submit
  for (let i = 0; i <= currentStep.value; i++) {
    if (!validateStep(i)) {
      currentStep.value = i;
      toast.error('Please fix the errors before submitting');
      return;
    }
  }
  emit('submit', buildPayload());
}
</script>

<template>
  <div class="space-y-6">
    <!-- Stepper header -->
    <ul class="steps steps-horizontal w-full">
      <li
        v-for="(step, idx) in STEPS"
        :key="step.id"
        class="step"
        :class="{ 'step-primary': currentStep >= idx }"
        @click="currentStep = idx"
      >
        {{ step.title }}
      </li>
    </ul>

    <!-- Step 1: What -->
    <div v-if="currentStep === 0" class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      <FormSelect
        v-model="form.status"
        label="Status"
        required
        :options="statusOptions"
        :error="errors.status"
      />
      <FormSelect
        v-model="form.priority"
        label="Priority"
        required
        :options="priorityOptions"
        :error="errors.priority"
      />
    </div>

    <!-- Step 2: Who & When -->
    <div v-else-if="currentStep === 1" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormSearchSelect
        v-model="form.assigneeId"
        label="Assignee"
        placeholder="Search a user…"
        :options="userOptions"
      />
      <FormSearchSelect
        v-model="form.reporterId"
        label="Reporter"
        placeholder="Search a user…"
        :options="userOptions"
      />
      <FormDate
        v-model="form.dueDate"
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

    <!-- Step 3: Meta -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
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

    <!-- Navigation -->
    <div class="flex items-center justify-between pt-4 border-t border-base-300">
      <button
        class="btn btn-ghost"
        :disabled="currentStep === 0 || saving"
        @click="prev"
      >
        <ChevronLeft class="w-4 h-4" /> Back
      </button>

      <div class="flex gap-2">
        <button class="btn btn-ghost" :disabled="saving" @click="emit('cancel')">
          Cancel
        </button>
        <button
          v-if="currentStep < STEPS.length - 1"
          class="btn btn-primary"
          :disabled="saving"
          @click="next"
        >
          Next <ChevronRight class="w-4 h-4" />
        </button>
        <button
          v-else
          class="btn btn-primary"
          :disabled="saving"
          @click="submit"
        >
          <span v-if="saving" class="loading loading-spinner loading-xs" />
          <Check v-else class="w-4 h-4" />
          {{ task ? 'Save' : 'Create task' }}
        </button>
      </div>
    </div>
  </div>
</template>