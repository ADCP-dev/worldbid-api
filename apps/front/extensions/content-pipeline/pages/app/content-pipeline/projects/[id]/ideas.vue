<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { z } from 'zod';
import { toast } from 'vue-sonner';
import { Plus, Sparkles } from 'lucide-vue-next';
import Kanban from '@base/ui-app/components/kanban/Kanban.vue';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import type {
  KanbanTask,
  KanbanStateConfig,
} from '@base/ui-app/components/kanban/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const route = useRoute();
const cp = useContentPipeline();

const projectId = computed(() => route.params.id as string);

const ideas = ref<any[]>([]);
const loading = ref(false);
const researching = ref(false);
const isCreateModalOpen = ref(false);
const isDetailModalOpen = ref(false);
const selectedIdea = ref<any | null>(null);

const createForm = ref({
  title: '',
  description: '',
  status: 'idea' as string,
});

const STATES: KanbanStateConfig[] = [
  { id: 'idea', title: 'Idea', order: 1, color: 'neutral' },
  { id: 'approved', title: 'Approved', order: 2, color: 'success' },
  { id: 'generating', title: 'Generating', order: 3, color: 'warning' },
  { id: 'generated', title: 'Generated', order: 4, color: 'info' },
  { id: 'rejected', title: 'Rejected', order: 5, color: 'error' },
];

const STATUS_LABELS: Record<string, string> = {
  idea: 'Idea',
  approved: 'Approved',
  generating: 'Generating',
  generated: 'Generated',
  rejected: 'Rejected',
};

// ─── Create form validation ───────────────────────────────────────────────

const STATUS_VALUES = STATES.map((s) => s.id) as [string, ...string[]];

const createSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  description: z.string().optional(),
  status: z.enum(STATUS_VALUES),
});

const createErrors = ref<Record<string, string>>({});

const statusOptions = STATES.map((s) => ({ label: s.title, value: s.id }));

// ─── Load ────────────────────────────────────────────────────────────────

async function loadIdeas() {
  loading.value = true;
  try {
    const res: any = await cp.getIdeas(projectId.value);
    ideas.value = res.data ?? res ?? [];
  } catch (err: any) {
    toast.error('Error loading ideas', { description: err.message });
  } finally {
    loading.value = false;
  }
}

onMounted(loadIdeas);

// ─── Kanban mapping ──────────────────────────────────────────────────────

const kanbanTasks = computed<KanbanTask[]>(() =>
  ideas.value.map((idea) => ({
    id: String(idea.id),
    title: idea.title,
    description: idea.description,
    stateId: idea.status,
    tags: (idea.tags ?? []).map((t: string) => ({ id: t, label: t })),
    metadata: { ...idea },
  })),
);

// ─── Actions ─────────────────────────────────────────────────────────────

async function handleUpdateTaskState({
  taskId,
  newStateId,
  oldStateId,
}: {
  taskId: string;
  newStateId: string;
  oldStateId: string;
}) {
  try {
    await cp.updateIdea(taskId, { status: newStateId });
    const idea = ideas.value.find((i) => String(i.id) === taskId);
    if (idea) idea.status = newStateId;
    toast.success('Idea moved', {
      description: `${STATUS_LABELS[oldStateId] ?? oldStateId} → ${STATUS_LABELS[newStateId] ?? newStateId}`,
    });
  } catch (err: any) {
    toast.error('Error moving idea', { description: err.message });
    await loadIdeas();
  }
}

async function handleCreate() {
  createErrors.value = {};
  const result = createSchema.safeParse(createForm.value);
  if (!result.success) {
    result.error.issues.forEach((issue) => {
      createErrors.value[issue.path[0] as string] = issue.message;
    });
    toast.error('Please fix the form errors');
    return;
  }
  try {
    await cp.createIdea(projectId.value, {
      title: createForm.value.title,
      description: createForm.value.description || undefined,
      status: createForm.value.status,
    });
    toast.success('Idea created');
    isCreateModalOpen.value = false;
    createForm.value = { title: '', description: '', status: 'idea' };
    await loadIdeas();
  } catch (err: any) {
    toast.error('Error creating idea', { description: err.message });
  }
}

async function handleDelete(taskId: string) {
  if (!confirm('Delete this idea?')) return;
  try {
    await cp.deleteIdea(taskId);
    ideas.value = ideas.value.filter((i) => String(i.id) !== taskId);
    isDetailModalOpen.value = false;
    toast.success('Idea deleted');
  } catch (err: any) {
    toast.error('Error deleting idea', { description: err.message });
  }
}

function handleClickTask(taskId: string) {
  selectedIdea.value = ideas.value.find((i) => String(i.id) === taskId) ?? null;
  if (selectedIdea.value) isDetailModalOpen.value = true;
}

function openCreate(status = 'idea') {
  createForm.value.status = status;
  isCreateModalOpen.value = true;
}

async function handleResearch() {
  researching.value = true;
  try {
    const res: any = await cp.researchIdeas(projectId.value);
    const count = Array.isArray(res) ? res.length : res?.ideas?.length ?? 0;
    toast.success('Research complete', {
      description: count ? `${count} ideas generated` : 'New ideas generated',
    });
    await loadIdeas();
  } catch (err: any) {
    toast.error('Research failed', { description: err.message });
  } finally {
    researching.value = false;
  }
}

async function handleGenerateDraft() {
  if (!selectedIdea.value) return;
  try {
    await cp.generateDraft(selectedIdea.value.id);
    toast.success('Draft generation started', {
      description: 'The draft will appear in the Drafts tab once ready.',
    });
    await loadIdeas();
  } catch (err: any) {
    toast.error('Error generating draft', { description: err.message });
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between px-4 py-3 border-b border-base-300">
      <div class="flex items-center gap-3">
        <NuxtLink :to="`/app/content-pipeline/projects/${projectId}`" class="btn btn-ghost btn-sm">
          ← Back
        </NuxtLink>
        <h1 class="text-xl font-bold">Ideas Board</h1>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="btn btn-outline btn-sm"
          :disabled="researching"
          @click="handleResearch"
        >
          <Sparkles class="w-4 h-4" />
          <span v-if="researching" class="loading loading-spinner loading-xs"></span>
          Research ideas
        </button>
        <button class="btn btn-primary btn-sm" @click="openCreate()">
          <Plus class="w-4 h-4" />
          New idea
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <div v-else class="flex-1 overflow-hidden">
      <Kanban
        :tasks="kanbanTasks"
        :states="STATES"
        group="content-pipeline-ideas"
        show-toolbar
        @update:task-state="handleUpdateTaskState"
        @delete-task="handleDelete"
        @click-task="handleClickTask"
        @create-task="(stateId: string) => openCreate(stateId)"
      />
    </div>

    <!-- Create Modal -->
    <dialog class="modal" :class="{ 'modal-open': isCreateModalOpen }">
      <div class="modal-box max-w-lg">
        <h3 class="font-bold text-lg mb-4">New Idea</h3>
        <div class="space-y-3">
          <FormInput
            v-model="createForm.title"
            label="Title"
            placeholder="Content idea title..."
            required
            :error="createErrors.title"
          />
          <FormTextArea
            v-model="createForm.description"
            label="Description"
            placeholder="Idea details..."
            :rows="3"
            :error="createErrors.description"
          />
          <FormSelect
            v-model="createForm.status"
            label="Status"
            :options="statusOptions"
            :error="createErrors.status"
          />
        </div>
        <div class="modal-action">
          <button class="btn" @click="isCreateModalOpen = false">Cancel</button>
          <button class="btn btn-primary" @click="handleCreate">Create</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="isCreateModalOpen = false">
        <button>close</button>
      </form>
    </dialog>

    <!-- Detail Modal -->
    <dialog class="modal" :class="{ 'modal-open': isDetailModalOpen }">
      <div class="modal-box max-w-lg">
        <h3 class="font-bold text-lg mb-2">{{ selectedIdea?.title }}</h3>
        <p v-if="selectedIdea?.description" class="text-sm text-base-content/70 mb-3">
          {{ selectedIdea.description }}
        </p>
        <div class="text-sm space-y-1">
          <div>
            <span class="font-medium">Status:</span>
            <span class="badge badge-sm badge-outline capitalize ml-1">
              {{ STATUS_LABELS[selectedIdea?.status] ?? selectedIdea?.status }}
            </span>
          </div>
          <div v-if="selectedIdea?.tags?.length">
            <span class="font-medium">Tags:</span>
            <span
              v-for="t in selectedIdea.tags"
              :key="t"
              class="badge badge-xs badge-outline ml-1"
            >{{ t }}</span>
          </div>
          <div v-if="selectedIdea?.createdAt">
            <span class="font-medium">Created:</span> {{ formatDate(selectedIdea.createdAt) }}
          </div>
        </div>
        <div class="modal-action">
          <button class="btn" @click="isDetailModalOpen = false">Close</button>
          <button
            v-if="selectedIdea?.status === 'approved' || selectedIdea?.status === 'generated'"
            class="btn btn-primary"
            @click="handleGenerateDraft"
          >
            Generate draft
          </button>
          <button
            class="btn btn-error btn-outline"
            @click="handleDelete(selectedIdea!.id)"
          >
            Delete
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="isDetailModalOpen = false">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>