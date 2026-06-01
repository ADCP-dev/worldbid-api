<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
import { Plus } from 'lucide-vue-next';
import FormMultipleSelect from '@base/ui-app/components/form/FormMultipleSelect.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import Kanban from '@/modules/base/ui-app/components/kanban/Kanban.vue';
import type {
  KanbanTask,
  KanbanStateConfig,
  KanbanTagConfig,
  KanbanColumnStyleConfig,
} from '@/modules/base/ui-app/components/kanban/types';

definePageMeta({
  layout: 'default',
});

const states = ref<KanbanStateConfig[]>([
  { id: 'todo', title: 'Por hacer', order: 1, color: 'neutral' },
  { id: 'in-progress', title: 'En progreso', order: 2, color: 'primary' },
  { id: 'review', title: 'Revisión', order: 3, color: 'warning' },
  { id: 'done', title: 'Terminado', order: 4, color: 'success' },
]);

const tasks = ref<KanbanTask[]>([
  {
    id: 'task-1',
    title: 'Diseñar interfaz del tablero Kanban',
    description: 'Crear los mockups y definir la experiencia de usuario para el nuevo tablero Kanban. Incluir estados, colores y animaciones.',
    stateId: 'todo',
    priority: 'high',
    dueDate: '2026-05-15',
    tags: [
      { id: 'tag-1', label: 'Diseño', color: 'badge-primary' },
      { id: 'tag-2', label: 'UX', color: 'badge-secondary' },
      { id: 'tag-3', label: 'Kanban', color: 'badge-accent' },
    ],
    assignee: {
      id: 'user-1',
      name: 'Ana García',
      email: 'ana.garcia@example.com',
      role: 'Diseñadora UX',
      avatarUrl: undefined,
    },
    checklist: [
      { id: 'chk-1', text: 'Investigar referencias', done: true },
      { id: 'chk-2', text: 'Crear wireframes', done: true },
      { id: 'chk-3', text: 'Definir paleta de colores', done: false },
      { id: 'chk-4', text: 'Prototipo interactivo', done: false },
    ],
    relatedTasks: [
      { id: 'task-2', title: 'Implementar componente Kanban', stateId: 'in-progress' },
    ],
    order: 1,
  },
  {
    id: 'task-2',
    title: 'Implementar componente Kanban',
    description: 'Desarrollar el componente Kanban en Vue 3 con soporte para drag-and-drop, edición inline y configuración flexible.',
    stateId: 'in-progress',
    priority: 'high',
    dueDate: '2026-05-20',
    tags: [
      { id: 'tag-3', label: 'Kanban', color: 'badge-accent' },
      { id: 'tag-4', label: 'Frontend', color: 'badge-info' },
    ],
    assignee: {
      id: 'user-2',
      name: 'Carlos López',
      email: 'carlos.lopez@example.com',
      role: 'Desarrollador Frontend',
      avatarUrl: undefined,
    },
    checklist: [
      { id: 'chk-5', text: 'Instalar dependencias', done: true },
      { id: 'chk-6', text: 'Crear tipos y componentes', done: true },
      { id: 'chk-7', text: 'Integrar drag-and-drop', done: false },
    ],
    relatedTasks: [
      { id: 'task-1', title: 'Diseñar interfaz del tablero Kanban', stateId: 'todo', relationType: 'blocked_by' },
    ],
    order: 2,
  },
]);

const tagConfig = ref<KanbanTagConfig>({
  maxVisible: 3,
});

const stateConfig = ref<KanbanColumnStyleConfig>({
  todo: {
    headerClass: 'bg-neutral/20',
  },
  'in-progress': {
    headerClass: 'bg-primary/20',
  },
  review: {
    headerClass: 'bg-warning/20',
  },
  done: {
    headerClass: 'bg-success/20',
  },
});

const selectedTask = ref<KanbanTask | null>(null);
const modalRef = ref<HTMLDialogElement | null>(null);
const newChecklistItemText = ref('');
const isEditingTitle = ref(false);
const comments = ref<Array<{ id: string; author: string; text: string; time: string }>>([]);
const newCommentText = ref('');
const selectedAssigneeId = ref('');
const chatContainer = ref<HTMLDivElement | null>(null);
const editingCommentId = ref<string | null>(null);
const editCommentText = ref('');

const availablePeople = [
  { value: '1', label: 'Juan Pérez' },
  { value: '2', label: 'María García' },
  { value: '3', label: 'Carlos López' },
  { value: '4', label: 'Ana Martínez' },
  { value: '5', label: 'Pedro Sánchez' },
];

const availableTagOptions = [
  { value: 'frontend', label: 'Frontend', color: 'badge-primary' },
  { value: 'backend', label: 'Backend', color: 'badge-secondary' },
  { value: 'design', label: 'Design', color: 'badge-accent' },
  { value: 'bug', label: 'Bug', color: 'badge-error' },
  { value: 'feature', label: 'Feature', color: 'badge-success' },
  { value: 'urgent', label: 'Urgente', color: 'badge-warning' },
  { value: 'docs', label: 'Documentación', color: 'badge-info' },
];

const selectedTagValues = computed<(string | number)[]>({
  get() {
    if (!selectedTask.value?.tags) return [];
    const tagLabels = selectedTask.value.tags.map(t => t.label.toLowerCase());
    return availableTagOptions
      .filter(opt => tagLabels.includes(opt.label.toLowerCase()))
      .map(opt => opt.value);
  },
  set(values) {
    if (!selectedTask.value) return;
      selectedTask.value.tags = values.map(v => {
        const opt = availableTagOptions.find(o => o.value === v);
        return {
          id: crypto.randomUUID(),
          label: opt?.label ?? String(v),
          color: opt?.color ?? 'badge-ghost',
        };
      });
  },
});

watch(selectedAssigneeId, (newId) => {
  if (!selectedTask.value) return;
  const person = availablePeople.find(p => p.value === newId);
  if (person) {
    selectedTask.value.assignee = { id: person.value, name: person.label, email: '', role: '' };
  } else {
    selectedTask.value.assignee = { id: '', name: '', email: '', role: '' };
  }
});

function handleUpdateTaskState(payload: { taskId: string; newStateId: string; oldStateId: string }) {
  const task = tasks.value.find((t) => t.id === payload.taskId);
  if (task) {
    task.stateId = payload.newStateId;
  }
  console.log('Estado actualizado:', payload);
}

function handleCreateTask(stateId: string) {
  const newTask: KanbanTask = {
    id: `task-${Date.now()}`,
    title: 'Nueva tarea',
    stateId,
    order: tasks.value.filter((t) => t.stateId === stateId).length + 1,
  };
  tasks.value.push(newTask);
  console.log('Tarea creada en estado:', stateId);
}

function handleUpdateTaskTitle(payload: { taskId: string; title: string }) {
  const task = tasks.value.find((t) => t.id === payload.taskId);
  if (task) {
    task.title = payload.title;
  }
  console.log('Título actualizado:', payload);
}

function handleDeleteTask(taskId: string) {
  const index = tasks.value.findIndex((t) => t.id === taskId);
  if (index > -1) {
    tasks.value.splice(index, 1);
  }
  console.log('Tarea eliminada:', taskId);
}

function handleClickTask(taskId: string) {
  const task = tasks.value.find((t) => t.id === taskId);
  if (task) {
    if (!task.assignee) {
      task.assignee = { id: '', name: '', email: '', role: '' };
    }
    selectedTask.value = task;
    selectedAssigneeId.value = task.assignee.id ?? '';
    comments.value = task.comments ? [...task.comments] : [];
    isEditingTitle.value = false;
    modalRef.value?.showModal();
    scrollChatToBottom();
  }
}

function handleToggleChecklist({ taskId, itemId }: { taskId: string; itemId: string }) {
  const task = tasks.value.find(t => t.id === taskId);
  if (!task?.checklist) return;
  const item = task.checklist.find(i => i.id === itemId);
  if (item) item.done = !item.done;
}

function handleAddChecklistItem({ taskId, text }: { taskId: string; text: string }) {
  const task = tasks.value.find(t => t.id === taskId);
  if (!task) return;
  if (!task.checklist) task.checklist = [];
  task.checklist.push({ id: crypto.randomUUID(), text, done: false });
}

function handleCreateState() {
  const newState: KanbanStateConfig = {
    id: crypto.randomUUID(),
    title: 'Nueva columna',
    order: states.value.length,
    color: 'border-base-300',
  };
  states.value.push(newState);
}

function handleAddChecklistItemFromModal() {
  if (!selectedTask.value || !newChecklistItemText.value.trim()) return;
  handleAddChecklistItem({
    taskId: selectedTask.value.id,
    text: newChecklistItemText.value.trim(),
  });
  newChecklistItemText.value = '';
}

function commitTitle() {
  if (!selectedTask.value) return;
  handleUpdateTaskTitle({ taskId: selectedTask.value.id, title: selectedTask.value.title });
  isEditingTitle.value = false;
}

function scrollChatToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  });
}

function handleAddComment() {
  if (!selectedTask.value || !newCommentText.value.trim()) return;
  const comment = {
    id: crypto.randomUUID(),
    author: 'Tú',
    text: newCommentText.value.trim(),
    time: new Date().toLocaleString(),
  };
  comments.value.push(comment);
  if (!selectedTask.value.comments) {
    selectedTask.value.comments = [];
  }
  selectedTask.value.comments.push(comment);
  newCommentText.value = '';
  scrollChatToBottom();
}

function startEditComment(commentId: string, currentText: string) {
  editingCommentId.value = commentId;
  editCommentText.value = currentText;
}

function saveEditComment(commentId: string) {
  if (!editCommentText.value.trim()) return;
  const comment = comments.value.find(c => c.id === commentId);
  if (comment) {
    comment.text = editCommentText.value.trim();
    // Also update in task
    if (selectedTask.value?.comments) {
      const taskComment = selectedTask.value.comments.find(c => c.id === commentId);
      if (taskComment) taskComment.text = editCommentText.value.trim();
    }
  }
  editingCommentId.value = null;
  editCommentText.value = '';
}

function deleteComment(commentId: string) {
  comments.value = comments.value.filter(c => c.id !== commentId);
  if (selectedTask.value?.comments) {
    selectedTask.value.comments = selectedTask.value.comments.filter(c => c.id !== commentId);
  }
}

function closeModal() {
  modalRef.value?.close();
  selectedTask.value = null;
  isEditingTitle.value = false;
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between px-4 py-3 border-b border-base-300">
      <h1 class="text-xl font-bold">Tablero Kanban</h1>
    </div>

    <div class="flex-1 overflow-hidden">
      <Kanban
        :tasks="tasks"
        :states="states"
        :tag-config="tagConfig"
        :state-config="stateConfig"
        @update:task-state="handleUpdateTaskState"
        @create-task="handleCreateTask"
        @update-task-title="handleUpdateTaskTitle"
        @delete-task="handleDeleteTask"
        @click-task="handleClickTask"
        @toggle-checklist-item="handleToggleChecklist"
        @add-checklist-item="handleAddChecklistItem"
        @create-state="handleCreateState"
      />
    </div>

    <!-- Modal de detalle de tarea -->
    <dialog ref="modalRef" class="modal">
      <div class="modal-box w-[80%] max-w-5xl">
        <h3
          v-if="selectedTask && !isEditingTitle"
          class="text-xl font-bold mb-4 cursor-pointer"
          @click="isEditingTitle = true"
        >
          {{ selectedTask.title }}
        </h3>
        <input
          v-if="selectedTask && isEditingTitle"
          v-model="selectedTask.title"
          class="input input-bordered input-sm w-full mb-4 text-xl font-bold"
          @blur="commitTitle"
          @keydown.enter="commitTitle"
        >

        <div v-if="selectedTask" class="space-y-4">
          <!-- Description -->
          <div>
            <h4 class="text-sm font-semibold mb-1">Descripción</h4>
            <textarea
              v-model="selectedTask.description"
              class="textarea textarea-bordered w-full text-sm"
              rows="3"
              placeholder="Descripción de la tarea..."
            />
          </div>

          <!-- Row 1: Tags | Assignee -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Tags -->
            <div>
              <h4 class="text-sm font-semibold mb-1">Etiquetas</h4>
              <FormMultipleSelect
                v-model="selectedTagValues"
                :options="availableTagOptions"
                placeholder="Selecciona etiquetas..."
              />
            </div>

            <!-- Assignee -->
            <div>
              <FormSelect
                v-model="selectedAssigneeId"
                :options="availablePeople"
                label="Asignado a"
                placeholder="Selecciona persona..."
              />
            </div>
          </div>

          <!-- Row 2: Checklist | Chat -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <!-- Checklist -->
            <div>
              <h4 class="text-sm font-semibold mb-1">Lista de verificación</h4>
              <div class="flex items-center gap-2 mb-2">
                <input
                  v-model="newChecklistItemText"
                  class="input input-bordered input-xs flex-1"
                  placeholder="Añadir tarea..."
                  @keydown.enter="handleAddChecklistItemFromModal"
                >
                <button class="btn btn-xs btn-ghost" @click="handleAddChecklistItemFromModal">
                  <Plus class="w-3 h-3" />
                </button>
              </div>
              <div
                v-for="item in selectedTask.checklist"
                :key="item.id"
                class="flex items-center gap-2"
              >
                <input
                  type="checkbox"
                  :checked="item.done"
                  class="checkbox checkbox-sm"
                  @change="handleToggleChecklist({ taskId: selectedTask!.id, itemId: item.id })"
                >
                <span :class="{ 'line-through text-base-content/50': item.done }">
                  {{ item.text }}
                </span>
              </div>
            </div>

            <!-- Chat -->
            <div class="flex flex-col">
              <h4 class="text-sm font-semibold mb-1">Comentarios</h4>
              <div ref="chatContainer" class="flex-1 h-[200px] overflow-y-auto bg-base-200 rounded-lg p-3 space-y-3 mb-2">
                <div v-if="comments.length === 0" class="text-sm opacity-50 italic text-center py-8">
                  Sin comentarios aún
                </div>
                <div
                  v-for="comment in comments"
                  :key="comment.id"
                  class="chat group"
                  :class="comment.author === 'Tú' ? 'chat-end' : 'chat-start'"
                >
                  <div class="chat-header text-xs opacity-50 mb-0.5">
                    {{ comment.author }}
                    <time class="text-xs opacity-30 ml-1">{{ comment.time }}</time>
                  </div>
                  <div v-if="editingCommentId === comment.id" class="flex items-center gap-1">
                    <input
                      v-model="editCommentText"
                      class="input input-bordered input-xs flex-1"
                      @keydown.enter="saveEditComment(comment.id)"
                      @keydown.escape="editingCommentId = null"
                      @blur="saveEditComment(comment.id)"
                    >
                  </div>
                  <div v-else class="chat-bubble text-sm" :class="comment.author === 'Tú' ? 'chat-bubble-primary' : 'chat-bubble'">
                    {{ comment.text }}
                    <div class="chat-footer opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex gap-1 justify-end">
                      <button class="btn btn-ghost btn-xs px-1" @click="startEditComment(comment.id, comment.text)">✏️</button>
                      <button class="btn btn-ghost btn-xs px-1" @click="deleteComment(comment.id)">🗑️</button>
                    </div>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <input
                  v-model="newCommentText"
                  class="input input-bordered input-sm flex-1"
                  placeholder="Escribir comentario..."
                  @keydown.enter="handleAddComment"
                >
                <button class="btn btn-sm btn-primary btn-square" @click="handleAddComment">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Due date + Priority -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <h4 class="text-sm font-semibold mb-1">Fecha límite</h4>
              <input
                v-model="selectedTask.dueDate"
                type="date"
                class="input input-bordered input-sm w-full"
              >
            </div>
          <div>
            <h4 class="text-sm font-semibold mb-1">Prioridad</h4>
            <select
              v-model="selectedTask.priority"
              class="select select-bordered select-sm w-full font-medium"
              :class="{
                'text-success': selectedTask.priority === 'low',
                'text-warning': selectedTask.priority === 'medium',
                'text-error': selectedTask.priority === 'high',
              }"
            >
              <option value="">Ninguna</option>
              <option value="low" class="text-success">Baja</option>
              <option value="medium" class="text-warning">Media</option>
              <option value="high" class="text-error">Alta</option>
            </select>
          </div>
          </div>
        </div>

        <div class="modal-action">
          <button class="btn" @click="closeModal">Cerrar</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="closeModal">Cerrar</button>
      </form>
    </dialog>
  </div>
</template>
