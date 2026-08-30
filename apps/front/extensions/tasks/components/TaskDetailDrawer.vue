<script setup lang="ts">
/**
 * TaskDetailDrawer — right-side drawer for task detail + inline create.
 *
 * Tabs: Overview (compact edit form) | Notes (TaskNotesList) | Activity
 * (TaskActivityTimeline). Notes/Activity only in edit mode.
 *
 * All API traffic goes through the useTasksQueries TanStack hooks; feedback
 * via vue-sonner toasts with `ext.tasks.*` i18n keys. Esc + backdrop close.
 *
 * Create mode: parent mounts with `create-status` preset (e.g. kanban column
 * "+"); on success the drawer closes and the board refetches.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { onKeyStroke } from '@vueuse/core';
import { X, Plus, Save } from 'lucide-vue-next';
import { z } from 'zod';
import { CalendarDate } from '@internationalized/date';
import type { DateValue } from '@internationalized/date';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue';
import FormDate from '@base/ui-app/components/form/FormDate.vue';
import TaskActivityTimeline from '@tasks/components/TaskActivityTimeline.vue';
import TaskNotesList from '@tasks/components/TaskNotesList.vue';
import {
  useCreateTaskMutation,
  useTaskActivitiesQuery,
  useTaskQuery,
  useTaskUsersQuery,
  useUpdateTaskMutation,
} from '@tasks/composables/useTasksQueries';
import {
  normalizeTags,
  tagColorFor,
  toUserLight,
} from '@tasks/composables/useKanbanMapping';
import { TASK_PRIORITIES, TASK_STATUSES } from '@tasks/types';
import type { TaskPayload, TaskPriority, TaskStatus, UserLight } from '@tasks/types';

const props = defineProps<{
  /** Edit mode when set; null/undefined → create mode. */
  taskId?: number | null;
  /** Preset status for create mode (kanban column "+"). */
  createStatus?: TaskStatus | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const { t } = useI18n();

// ─── Tabs ────────────────────────────────────────────────────────────────

type DrawerTab = 'overview' | 'notes' | 'activity';
const tab = ref<DrawerTab>('overview');
watch(
  () => props.taskId,
  () => {
    tab.value = 'overview';
  },
);

// ─── Data ────────────────────────────────────────────────────────────────

const taskIdRef = computed(() => props.taskId ?? undefined);
const taskQuery = useTaskQuery(taskIdRef);
const usersQuery = useTaskUsersQuery();
const activitiesQuery = useTaskActivitiesQuery(taskIdRef);

const users = computed<UserLight[]>(() => toUserLight(usersQuery.data.value ?? []));

const updateMutation = useUpdateTaskMutation();
const createMutation = useCreateTaskMutation();
const saving = computed(
  () => updateMutation.isPending.value || createMutation.isPending.value,
);

// ─── Form state ──────────────────────────────────────────────────────────

const isCreate = computed(() => props.taskId == null);

// dueDate is a shallowRef: vue's deep ref() UnwrapRef mangles the
// DateValue class union and breaks the FormDate v-model type.
const form = ref({
  title: '',
  description: '',
  // string (not the enum union): FormSelect's v-model writes string|number.
  // The submit schema validates and narrows them back to the enum.
  status: (props.createStatus ?? 'pending') as string,
  priority: 'medium' as string,
  estimateHours: '' as string | number,
  tags: [] as string[],
});
const dueDate = shallowRef<DateValue | null>(null);
const newTag = ref('');
const errors = ref<Record<string, string>>({});

function fillFromTask(task: {
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  estimateHours?: number | null;
  tags?: string[] | Record<string, unknown> | null;
}) {
  let due: DateValue | null = null;
  if (task.dueDate) {
    const d = new Date(task.dueDate);
    due = new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  dueDate.value = due;
  form.value = {
    title: task.title,
    description: task.description ?? '',
    status: task.status,
    priority: task.priority,
    estimateHours: task.estimateHours ?? '',
    tags: normalizeTags(task.tags),
  };
}

watch(
  () => taskQuery.data.value,
  (task) => {
    if (task) fillFromTask(task);
  },
  { immediate: true },
);

// ─── Options ─────────────────────────────────────────────────────────────

const STATUS_OPTIONS = computed(() =>
  TASK_STATUSES.map((s) => ({ value: s, label: t(`ext.tasks.status.${s}`) })),
);
const PRIORITY_OPTIONS = computed(() =>
  TASK_PRIORITIES.map((p) => ({ value: p, label: t(`ext.tasks.priority.${p}`) })),
);

// ─── Tags chips ──────────────────────────────────────────────────────────

function addTag() {
  const label = newTag.value.trim();
  if (!label) return;
  if (!form.value.tags.includes(label)) {
    form.value.tags = [...form.value.tags, label];
  }
  newTag.value = '';
}

function removeTag(label: string) {
  form.value.tags = form.value.tags.filter((t) => t !== label);
}

// ─── Validation + submit ─────────────────────────────────────────────────

function estimateToNumber(): number | null {
  const raw = form.value.estimateHours;
  if (raw === '' || raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function dueDateToString(d: DateValue | null): string | null {
  if (!d) return null;
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}T00:00:00.000Z`;
}

function submit() {
  errors.value = {};
  // Built per-submit so validation messages pick up the active locale.
  const schema = z.object({
    title: z.string().trim().min(2, t('ext.tasks.detail.validationTitle')),
    description: z.string(),
    status: z.enum(TASK_STATUSES as [TaskStatus, ...TaskStatus[]]),
    priority: z.enum(TASK_PRIORITIES as [TaskPriority, ...TaskPriority[]]),
    estimateHours: z.number().nullable(),
    dueDate: z.string().nullable(),
    tags: z.array(z.string()),
  });

  const parsed = schema.safeParse({
    title: form.value.title,
    description: form.value.description,
    status: form.value.status,
    priority: form.value.priority,
    estimateHours: estimateToNumber(),
    dueDate: dueDateToString(dueDate.value),
    tags: form.value.tags,
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '');
      if (key && !errors.value[key]) errors.value[key] = issue.message;
    }
    return;
  }
  const payload: TaskPayload = parsed.data;

  if (props.taskId != null) {
    updateMutation.mutate(
      { id: props.taskId, data: payload },
      {
        onSuccess: () => toast.success(t('ext.tasks.detail.saved')),
        onError: (err: unknown) =>
          toast.error(t('ext.tasks.detail.saveFailed'), {
            description: errorMessage(err),
          }),
      },
    );
  } else {
    createMutation.mutate(payload, {
      onSuccess: () => {
        toast.success(t('ext.tasks.detail.created'));
        emit('close');
      },
      onError: (err: unknown) =>
        toast.error(t('ext.tasks.detail.createFailed'), {
          description: errorMessage(err),
        }),
    });
  }
}

// ─── Lifecycle (Esc close + body scroll lock) ────────────────────────────

function close() {
  emit('close');
}
onKeyStroke('Escape', () => close());

onMounted(() => {
  document.body.style.overflow = 'hidden';
});
onBeforeUnmount(() => {
  document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/40"
        @click="close"
      />

      <!-- Right panel -->
      <aside class="relative h-full w-full max-w-xl bg-base-100 border-l border-base-300 shadow-2xl flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between gap-3 px-5 py-4 border-b border-base-300">
          <h2 class="text-lg font-bold line-clamp-1">
            {{ isCreate ? t('ext.tasks.detail.createTitle') : t('ext.tasks.detail.editTitle') }}
          </h2>
          <button
            class="btn btn-ghost btn-sm btn-circle"
            :title="t('ext.tasks.detail.close')"
            @click="close"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Tabs -->
        <div
          v-if="!isCreate"
          role="tablist"
          class="tabs tabs-boxed tabs-sm px-5 pt-3 flex-shrink-0"
        >
          <button
            role="tab"
            class="tab"
            :class="{ 'tab-active': tab === 'overview' }"
            @click="tab = 'overview'"
          >{{ t('ext.tasks.detail.tabOverview') }}</button>
          <button
            role="tab"
            class="tab"
            :class="{ 'tab-active': tab === 'notes' }"
            @click="tab = 'notes'"
          >{{ t('ext.tasks.notes.title') }}</button>
          <button
            role="tab"
            class="tab"
            :class="{ 'tab-active': tab === 'activity' }"
            @click="tab = 'activity'"
          >{{ t('ext.tasks.detail.tabActivity') }}</button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto px-5 py-4">
          <!-- Edit: loading / error -->
          <div
            v-if="!isCreate && taskQuery.isLoading.value"
            class="flex items-center justify-center py-12"
          >
            <span class="loading loading-spinner loading-md text-primary" />
          </div>

          <div
            v-else-if="!isCreate && taskQuery.isError.value"
            class="flex flex-col items-center gap-3 py-12 text-center"
          >
            <p class="text-sm text-error">{{ t('ext.tasks.detail.loadFailed') }}</p>
            <button
              class="btn btn-sm btn-outline"
              @click="() => taskQuery.refetch()"
            >
              {{ t('ext.tasks.detail.retry') }}
            </button>
          </div>

          <!-- Overview: compact edit form -->
          <form
            v-else
            class="space-y-4"
            @submit.prevent="submit"
          >
            <FormInput
              v-model="form.title"
              :label="t('ext.tasks.detail.fieldTitle')"
              required
              :placeholder="t('ext.tasks.detail.titlePlaceholder')"
              :error="errors.title"
            />

            <FormTextArea
              v-model="form.description"
              :label="t('ext.tasks.detail.fieldDescription')"
              :rows="4"
              :placeholder="t('ext.tasks.detail.descriptionPlaceholder')"
            />

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormSelect
                v-model="form.status"
                :label="t('ext.tasks.detail.fieldStatus')"
                :options="STATUS_OPTIONS"
                required
              />
              <FormSelect
                v-model="form.priority"
                :label="t('ext.tasks.detail.fieldPriority')"
                :options="PRIORITY_OPTIONS"
                required
              />
              <FormDate
                v-model="dueDate"
                :label="t('ext.tasks.detail.fieldDueDate')"
              />
              <FormInput
                v-model="form.estimateHours"
                :label="t('ext.tasks.detail.fieldEstimate')"
                type="number"
                step="0.5"
                :placeholder="t('ext.tasks.detail.estimatePlaceholder')"
              />
            </div>

            <!-- Tags chips -->
            <div class="space-y-2">
              <span class="label-text font-semibold">{{ t('ext.tasks.detail.fieldTags') }}</span>
              <div
                v-if="form.tags.length > 0"
                class="flex flex-wrap gap-2"
              >
                <span
                  v-for="tag in form.tags"
                  :key="tag"
                  class="badge badge-sm gap-1"
                  :class="tagColorFor(tag)"
                >
                  {{ tag }}
                  <button
                    type="button"
                    class="inline-flex items-center opacity-70 hover:opacity-100"
                    :title="t('ext.tasks.detail.removeTag')"
                    @click="removeTag(tag)"
                  >
                    <X class="w-3 h-3" />
                  </button>
                </span>
              </div>
              <div class="flex gap-2">
                <input
                  v-model="newTag"
                  type="text"
                  class="input input-bordered input-sm flex-1"
                  :placeholder="t('ext.tasks.detail.tagsPlaceholder')"
                  @keydown.enter.prevent="addTag"
                >
                <button
                  type="button"
                  class="btn btn-sm btn-outline"
                  :disabled="!newTag.trim()"
                  @click="addTag"
                >
                  <Plus class="w-3.5 h-3.5" />
                  {{ t('ext.tasks.detail.addTag') }}
                </button>
              </div>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                class="btn btn-ghost"
                :disabled="saving"
                @click="close"
              >
                {{ t('ext.tasks.detail.cancel') }}
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                :disabled="saving"
              >
                <span
                  v-if="saving"
                  class="loading loading-spinner loading-xs"
                />
                <Save
                  v-else
                  class="w-4 h-4"
                />
                {{ t('ext.tasks.detail.save') }}
              </button>
            </div>
          </form>

          <!-- Notes tab -->
          <TaskNotesList
            v-if="tab === 'notes' && !isCreate && props.taskId != null"
            :task-id="props.taskId"
            :users="users"
          />

          <!-- Activity tab -->
          <TaskActivityTimeline
            v-else-if="tab === 'activity' && !isCreate"
            :activities="activitiesQuery.data.value ?? []"
            :users="users"
            :loading="activitiesQuery.isLoading.value"
          />
        </div>
      </aside>
    </div>
  </Teleport>
</template>
