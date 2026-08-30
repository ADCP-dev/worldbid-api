<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { useRouter } from 'vue-router';
import { Lightbulb } from 'lucide-vue-next';
import PageShell from '../../components/PageShell.vue';
import EmptyState from '@base/ui-app/components/dashboard/EmptyState.vue';
import Kanban from '@base/ui-app/components/kanban/Kanban.vue';
import type { KanbanTask, KanbanStateConfig } from '@base/ui-app/components/kanban/types';
import {
  useIdeasQuery,
  useCreateIdeaMutation,
  useUpdateIdeaStatusMutation,
  useDeleteIdeaMutation,
  type UpIdea,
} from '../../composables/useUploadPostApi';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const { t } = useI18n();
const router = useRouter();

const ideasQuery = useIdeasQuery();
const createIdea = useCreateIdeaMutation();
const updateStatus = useUpdateIdeaStatusMutation();
const deleteIdea = useDeleteIdeaMutation();

const states: KanbanStateConfig[] = [
  { id: 'idea', title: 'Idea', order: 0 },
  { id: 'drafting', title: 'Drafting', order: 10 },
  { id: 'ready', title: 'Ready', order: 20 },
  { id: 'scheduled', title: 'Scheduled', order: 30 },
  { id: 'published', title: 'Published', order: 40 },
];

const tasks = computed<KanbanTask[]>(() =>
  ((ideasQuery.data.value ?? []) as UpIdea[]).map((idea: UpIdea) => ({
    id: idea.id,
    title: idea.title,
    description: idea.description ?? undefined,
    stateId: idea.status,
    tags: (idea.tags ?? []).map((tag: string, i: number) => ({ id: `${idea.id}-${i}`, label: tag })),
    order: idea.order ?? 0,
    metadata: { platforms: idea.platforms ?? [], mediaUrl: idea.mediaUrl, scheduledAt: idea.scheduledAt },
  })),
);

function onTaskStateChange(event: { taskId: string; newStateId: string; oldStateId: string }) {
  updateStatus.mutate(
    { id: event.taskId, status: event.newStateId as UpIdea['status'] },
    {
      onSuccess: () => toast.success(t('ext.upload-post.common.saved')),
      onError: () => toast.error(t('ext.upload-post.common.requestFailed')),
    },
  );
}

function onCreateTask() {
  const title = window.prompt(t('ext.upload-post.ideas.newIdeaPrompt'));
  if (!title) return;
  createIdea.mutate(
    { title },
    {
      onSuccess: () => toast.success(t('ext.upload-post.common.created')),
      onError: () => toast.error(t('ext.upload-post.common.requestFailed')),
    },
  );
}

function onTaskClick(taskId: string) {
  const idea = ((ideasQuery.data.value ?? []) as UpIdea[]).find(
    (i: UpIdea) => i.id === taskId,
  );
  if (!idea) return;
  void router.push({
    path: '/app/upload-post/compose',
    query: {
      prefill: '1',
      caption: idea.caption ?? idea.description ?? idea.title,
      title: idea.title,
    },
  });
}

function onDeleteTask(taskId: string) {
  deleteIdea.mutate(taskId, {
    onSuccess: () => toast.success(t('ext.upload-post.common.deleted')),
    onError: () => toast.error(t('ext.upload-post.common.requestFailed')),
  });
}
</script>

<template>
  <PageShell
    :title="t('ext.upload-post.pages.ideas.title')"
    :subtitle="t('ext.upload-post.pages.ideas.subtitle')"
    :icon="Lightbulb"
    :loading="ideasQuery.isLoading.value"
  >
    <Kanban
      :tasks="tasks"
      :states="states"
      show-toolbar
      @create-task="onCreateTask"
      @delete-task="onDeleteTask"
      @click-task="onTaskClick"
      @update:task-state="onTaskStateChange"
    />
    <EmptyState
      v-if="!ideasQuery.isLoading.value && (ideasQuery.data.value ?? []).length === 0"
      :icon="Lightbulb"
      :title="t('ext.upload-post.pages.ideas.title')"
      :description="t('ext.upload-post.pages.ideas.subtitle')"
    >
      <template #action>
        <button type="button" class="btn btn-primary btn-sm" @click="onCreateTask">
          {{ t('ext.upload-post.ideas.newIdea') }}
        </button>
      </template>
    </EmptyState>
  </PageShell>
</template>