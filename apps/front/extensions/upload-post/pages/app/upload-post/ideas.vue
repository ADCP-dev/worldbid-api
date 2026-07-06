<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { toast } from 'vue-sonner';
import { LayoutGrid, List, Plus } from 'lucide-vue-next';
import Kanban from '@/modules/base/ui-app/components/kanban/Kanban.vue';
import type {
  KanbanTask,
  KanbanStateConfig,
} from '@/modules/base/ui-app/components/kanban/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const {
  getIdeas,
  createIdea,
  updateIdea,
  deleteIdea,
  updateIdeaStatus,
} = useUploadPost();

// ─── State ──────────────────────────────────────────────────────────────

const ideas = ref<any[]>([]);
const loading = ref(false);
const viewMode = ref<'kanban' | 'list'>('kanban');
const isCreateModalOpen = ref(false);
const isDetailModalOpen = ref(false);
const selectedIdea = ref<any | null>(null);

const createForm = ref({
  title: '',
  description: '',
  platforms: [] as string[],
  tags: [] as string[],
  priority: 'medium' as string,
  status: 'idea' as string,
});

const ALL_PLATFORMS = [
  'instagram', 'tiktok', 'youtube', 'linkedin',
  'facebook', 'x', 'threads', 'pinterest', 'reddit', 'bluesky',
];

const STATES: KanbanStateConfig[] = [
  { id: 'idea', title: 'Ideas', order: 1, color: 'neutral' },
  { id: 'drafting', title: 'Borrador', order: 2, color: 'primary' },
  { id: 'ready', title: 'Listo', order: 3, color: 'warning' },
  { id: 'scheduled', title: 'Programado', order: 4, color: 'info' },
  { id: 'published', title: 'Publicado', order: 5, color: 'success' },
];

const STATUS_LABELS: Record<string, string> = {
  idea: 'Ideas',
  drafting: 'Borrador',
  ready: 'Listo',
  scheduled: 'Programado',
  published: 'Publicado',
};

const PRIORITY_BADGE: Record<string, string> = {
  low: 'badge-ghost',
  medium: 'badge-warning',
  high: 'badge-error',
};

// ─── Load ────────────────────────────────────────────────────────────────

async function loadIdeas() {
  loading.value = true;
  try {
    ideas.value = await getIdeas();
  } catch (err: unknown) {
    toast.error('Error cargando ideas', { description: err instanceof Error ? err.message : 'Error' });
  } finally {
    loading.value = false;
  }
}

onMounted(loadIdeas);

// ─── Kanban mapping ─────────────────────────────────────────────────────

const kanbanTasks = computed<KanbanTask[]>(() =>
  ideas.value.map((idea) => ({
    id: idea.id,
    title: idea.title,
    description: idea.description,
    stateId: idea.status,
    priority: idea.priority,
    tags: (idea.tags ?? []).map((t: string) => ({ id: t, label: t })),
    order: idea.order,
    metadata: { ...idea },
  })),
);

// ─── List view grouping ──────────────────────────────────────────────────

const ideasByStatus = computed(() => {
  const map: Record<string, any[]> = {};
  for (const state of STATES) {
    map[state.id] = ideas.value
      .filter((i) => i.status === state.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  return map;
});

// ─── Actions ─────────────────────────────────────────────────────────────

async function handleCreate() {
  if (!createForm.value.title.trim()) {
    toast.error('El título es obligatorio');
    return;
  }
  try {
    await createIdea({
      title: createForm.value.title,
      description: createForm.value.description || undefined,
      platforms: createForm.value.platforms.length ? createForm.value.platforms : undefined,
      tags: createForm.value.tags.length ? createForm.value.tags : undefined,
      priority: createForm.value.priority,
      status: createForm.value.status,
    });
    toast.success('Idea creada');
    isCreateModalOpen.value = false;
    createForm.value = { title: '', description: '', platforms: [], tags: [], priority: 'medium', status: 'idea' };
    await loadIdeas();
  } catch (err: unknown) {
    toast.error('Error', { description: err instanceof Error ? err.message : 'Error' });
  }
}

async function handleUpdateTaskState({ taskId, newStateId }: { taskId: string; newStateId: string; oldStateId: string }) {
  try {
    await updateIdeaStatus(taskId, newStateId);
    // Optimistic update
    const idea = ideas.value.find((i) => i.id === taskId);
    if (idea) idea.status = newStateId;
  } catch (err: unknown) {
    toast.error('Error moviendo idea', { description: err instanceof Error ? err.message : 'Error' });
    await loadIdeas();
  }
}

async function handleUpdateTitle({ taskId, title }: { taskId: string; title: string }) {
  try {
    await updateIdea(taskId, { title });
    const idea = ideas.value.find((i) => i.id === taskId);
    if (idea) idea.title = title;
  } catch (err: unknown) {
    toast.error('Error', { description: err instanceof Error ? err.message : 'Error' });
  }
}

async function handleDelete(taskId: string) {
  try {
    await deleteIdea(taskId);
    ideas.value = ideas.value.filter((i) => i.id !== taskId);
    isDetailModalOpen.value = false;
    toast.success('Idea eliminada');
  } catch (err: unknown) {
    toast.error('Error', { description: err instanceof Error ? err.message : 'Error' });
  }
}

function handleClickTask(taskId: string) {
  selectedIdea.value = ideas.value.find((i) => i.id === taskId) ?? null;
  if (selectedIdea.value) isDetailModalOpen.value = true;
}

function togglePlatform(p: string, arr: string[]) {
  const idx = arr.indexOf(p);
  if (idx > -1) arr.splice(idx, 1);
  else arr.push(p);
}

function openCreate(status = 'idea') {
  createForm.value.status = status;
  isCreateModalOpen.value = true;
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between px-4 py-3 border-b border-base-300">
      <h1 class="text-xl font-bold">Content Ideas</h1>
      <div class="flex items-center gap-2">
        <!-- View toggle -->
        <div class="join">
          <button
            class="btn btn-sm join-item"
            :class="{ 'btn-primary': viewMode === 'kanban' }"
            @click="viewMode = 'kanban'"
          >
            <LayoutGrid class="w-4 h-4" />
          </button>
          <button
            class="btn btn-sm join-item"
            :class="{ 'btn-primary': viewMode === 'list' }"
            @click="viewMode = 'list'"
          >
            <List class="w-4 h-4" />
          </button>
        </div>
        <button class="btn btn-primary btn-sm" @click="openCreate()">
          <Plus class="w-4 h-4" />
          Nueva idea
        </button>
      </div>
    </div>

    <!-- Kanban View -->
    <div v-if="viewMode === 'kanban'" class="flex-1 overflow-hidden">
      <div v-if="loading" class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg text-primary" />
      </div>
      <Kanban
        v-else
        :tasks="kanbanTasks"
        :states="STATES"
        group="content-ideas"
        @update:task-state="handleUpdateTaskState"
        @update-task-title="handleUpdateTitle"
        @delete-task="handleDelete"
        @click-task="handleClickTask"
        @create-task="(stateId: string) => openCreate(stateId)"
      />
    </div>

    <!-- List View -->
    <div v-else class="flex-1 overflow-auto p-4 space-y-6">
      <div v-if="loading" class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg text-primary" />
      </div>
      <template v-else>
        <div v-for="state in STATES" :key="state.id">
          <div class="flex items-center gap-2 mb-3">
            <h2 class="text-sm font-semibold uppercase">{{ STATUS_LABELS[state.id] }}</h2>
            <span class="badge badge-sm badge-ghost">{{ ideasByStatus[state.id]?.length ?? 0 }}</span>
          </div>
          <div v-if="(ideasByStatus[state.id]?.length ?? 0) === 0" class="text-sm text-base-content/40 mb-4">
            Sin elementos
          </div>
          <div v-else class="space-y-2 mb-4">
            <div
              v-for="idea in ideasByStatus[state.id]"
              :key="idea.id"
              class="card card-compact bg-base-100 shadow-sm border border-base-300 cursor-pointer hover:shadow-md transition-shadow"
              @click="handleClickTask(idea.id)"
            >
              <div class="card-body p-3 flex-row items-center justify-between">
                <div class="flex-1 min-w-0">
                  <h3 class="text-sm font-medium truncate">{{ idea.title }}</h3>
                  <p v-if="idea.description" class="text-xs text-base-content/60 truncate">{{ idea.description }}</p>
                  <div v-if="idea.platforms?.length" class="flex gap-1 mt-1">
                    <span v-for="p in idea.platforms" :key="p" class="badge badge-xs badge-outline">{{ p }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span v-if="idea.priority" class="badge badge-xs" :class="PRIORITY_BADGE[idea.priority]">{{ idea.priority }}</span>
                  <span v-if="idea.tags?.length" class="text-xs text-base-content/40">{{ idea.tags.length }} tags</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>

  <!-- Create Modal -->
  <dialog class="modal" :class="{ 'modal-open': isCreateModalOpen }">
    <div class="modal-box max-w-lg">
      <h3 class="font-bold text-lg mb-4">Nueva Idea</h3>
      <div class="space-y-3">
        <div class="form-control">
          <label class="label"><span class="label-text">Título *</span></label>
          <input v-model="createForm.title" class="input input-bordered w-full" placeholder="Idea de contenido..." >
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">Descripción</span></label>
          <textarea v-model="createForm.description" class="textarea textarea-bordered w-full" rows="3" placeholder="Detalles de la idea..." />
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">Plataformas</span></label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="p in ALL_PLATFORMS"
              :key="p"
              class="badge cursor-pointer"
              :class="{ 'badge-primary': createForm.platforms.includes(p) }"
              @click="togglePlatform(p, createForm.platforms)"
            >
              {{ p }}
            </button>
          </div>
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">Prioridad</span></label>
          <select v-model="createForm.priority" class="select select-bordered w-full">
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
          </select>
        </div>
      </div>
      <div class="modal-action">
        <button class="btn" @click="isCreateModalOpen = false">Cancelar</button>
        <button class="btn btn-primary" @click="handleCreate">Crear</button>
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
      <p v-if="selectedIdea?.description" class="text-sm text-base-content/70 mb-3">{{ selectedIdea.description }}</p>
      <div class="text-sm space-y-1">
        <div><span class="font-medium">Estado:</span> {{ STATUS_LABELS[selectedIdea?.status] }}</div>
        <div v-if="selectedIdea?.priority"><span class="font-medium">Prioridad:</span> {{ selectedIdea.priority }}</div>
        <div v-if="selectedIdea?.platforms?.length">
          <span class="font-medium">Plataformas:</span>
          <span v-for="p in selectedIdea.platforms" :key="p" class="badge badge-xs badge-outline ml-1">{{ p }}</span>
        </div>
        <div v-if="selectedIdea?.createdAt"><span class="font-medium">Creada:</span> {{ new Date(selectedIdea.createdAt).toLocaleDateString() }}</div>
      </div>
      <div class="modal-action">
        <button class="btn" @click="isDetailModalOpen = false">Cerrar</button>
        <button class="btn btn-error btn-outline" @click="handleDelete(selectedIdea!.id)">Eliminar</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="isDetailModalOpen = false">
      <button>close</button>
    </form>
  </dialog>
</template>