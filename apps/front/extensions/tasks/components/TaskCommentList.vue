<script setup lang="ts">
/**
 * TaskCommentList — list of comments + input to add new comments.
 * Used inside the task detail "Comments" tab.
 */
import { ref, computed } from 'vue';
import { toast } from 'vue-sonner';
import { Send } from 'lucide-vue-next';
import type { TaskComment, UserLight } from '../types';

const props = defineProps<{
  comments: TaskComment[];
  users: UserLight[];
  taskId: number;
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'add', content: string): void;
}>();

const newComment = ref('');
const submitting = ref(false);

const userMap = computed<Record<number, UserLight>>(() => {
  const m: Record<number, UserLight> = {};
  for (const u of props.users) m[u.id] = u;
  return m;
});

function initials(user: UserLight | undefined): string {
  if (!user) return '?';
  const name = `${user.firstName} ${user.lastName}`.trim();
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

async function submitComment() {
  const content = newComment.value.trim();
  if (!content) return;
  submitting.value = true;
  try {
    emit('add', content);
    newComment.value = '';
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Failed to add comment');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Comment list -->
    <div v-if="loading" class="flex justify-center py-6">
      <span class="loading loading-spinner loading-sm text-primary" />
    </div>

    <div
      v-else-if="comments.length === 0"
      class="text-center py-8 text-base-content/40 text-sm"
    >
      No comments yet
    </div>

    <ul v-else class="space-y-3">
      <li
        v-for="comment in comments"
        :key="comment.id"
        class="flex gap-3"
      >
        <div class="avatar shrink-0">
          <div class="w-8 h-8 rounded-full bg-neutral text-neutral-content text-xs flex items-center justify-center">
            {{ initials(comment.authorId ? userMap[comment.authorId] : undefined) }}
          </div>
        </div>
        <div class="flex-1 bg-base-200 rounded-lg p-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">
              {{ comment.authorId ? (userMap[comment.authorId]?.firstName ?? 'User') : 'Unknown' }}
            </span>
            <span class="text-xs text-base-content/40">{{ timeAgo(comment.createdAt) }}</span>
          </div>
          <p class="text-sm text-base-content/80 mt-1 whitespace-pre-wrap">{{ comment.content }}</p>
        </div>
      </li>
    </ul>

    <!-- New comment input -->
    <div class="flex gap-2 pt-2 border-t border-base-300">
      <textarea
        v-model="newComment"
        class="textarea textarea-bordered flex-1 text-sm"
        rows="2"
        placeholder="Write a comment…"
        :disabled="submitting"
        @keydown.ctrl.enter="submitComment"
      />
      <button
        class="btn btn-primary btn-sm self-end"
        :disabled="!newComment.trim() || submitting"
        @click="submitComment"
      >
        <span v-if="submitting" class="loading loading-spinner loading-xs" />
        <Send v-else class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>