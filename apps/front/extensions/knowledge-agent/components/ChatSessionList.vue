<script setup lang="ts">
import { computed, ref } from 'vue';
import { Plus, Trash2 } from 'lucide-vue-next';
import type { ChatSession } from '@ka/composables/useChatStream';
import FormInput from '@base/ui-app/components/form/FormInput.vue';

const props = defineProps<{
  sessions: ChatSession[];
  activeId: string | null;
  loading: boolean;
}>();

const emit = defineEmits<{
  select: [id: string];
  delete: [id: string];
  new: [];
}>();

const { t } = useI18n();

const search = ref('');

const filtered = computed<ChatSession[]>(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return props.sessions;
  return props.sessions.filter((s) => s.title.toLowerCase().includes(q));
});

interface SessionGroup {
  key: string;
  label: string;
  items: ChatSession[];
}

/** Group sessions by recency: Today / Yesterday / This week / Older. */
const grouped = computed<SessionGroup[]>(() => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const buckets: Record<string, ChatSession[]> = {
    today: [],
    yesterday: [],
    week: [],
    older: [],
  };
  for (const s of filtered.value) {
    const ts = new Date(s.updatedAt).getTime();
    if (Number.isNaN(ts)) buckets.older.push(s);
    else if (ts >= startOfToday) buckets.today.push(s);
    else if (ts >= startOfYesterday) buckets.yesterday.push(s);
    else if (ts >= startOfWeek) buckets.week.push(s);
    else buckets.older.push(s);
  }
  const out: SessionGroup[] = [];
  if (buckets.today.length) out.push({ key: 'today', label: t('ext.ka.chat.groups.today', 'Today'), items: buckets.today });
  if (buckets.yesterday.length) out.push({ key: 'yesterday', label: t('ext.ka.chat.groups.yesterday', 'Yesterday'), items: buckets.yesterday });
  if (buckets.week.length) out.push({ key: 'week', label: t('ext.ka.chat.groups.thisWeek', 'This week'), items: buckets.week });
  if (buckets.older.length) out.push({ key: 'older', label: t('ext.ka.chat.groups.older', 'Older'), items: buckets.older });
  return out;
});

function formatRelativeTime(date: string): string {
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return t('ext.ka.chat.justNow', 'just now');
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(date).toLocaleDateString();
}

/* Delete confirmation modal */
const pendingDelete = ref<ChatSession | null>(null);
const deleteDialog = ref<HTMLDialogElement | null>(null);

function askDelete(session: ChatSession): void {
  pendingDelete.value = session;
  deleteDialog.value?.showModal();
}
function cancelDelete(): void {
  pendingDelete.value = null;
  deleteDialog.value?.close();
}
function confirmDelete(): void {
  if (pendingDelete.value) emit('delete', pendingDelete.value.id);
  pendingDelete.value = null;
  deleteDialog.value?.close();
}
</script>

<template>
  <aside class="flex flex-col h-full bg-base-200 border-r border-base-300">
    <div class="p-3 space-y-3 border-b border-base-300">
      <button
        class="btn btn-primary btn-sm w-full gap-1.5"
        @click="emit('new')"
      >
        <Plus :size="15" />
        {{ t('ext.ka.chat.new') }}
      </button>
      <FormInput
        v-model="search"
        :label="t('ext.ka.chat.search')"
        type="text"
      />
    </div>

    <div class="flex-1 overflow-y-auto px-2 py-2">
      <div
        v-if="loading && sessions.length === 0"
        class="flex justify-center py-8"
      >
        <span class="loading loading-spinner loading-sm" />
      </div>
      <p
        v-else-if="!loading && sessions.length === 0"
        class="text-center py-8 text-base-content/40 text-sm"
      >
        {{ t('ext.ka.chat.emptySessions') }}
      </p>
      <p
        v-else-if="filtered.length === 0"
        class="text-center py-8 text-base-content/40 text-sm"
      >
        {{ t('ext.ka.chat.noResults') }}
      </p>

      <div v-for="group in grouped" :key="group.key" class="mb-3">
        <div class="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-base-content/40">
          {{ group.label }}
        </div>
        <button
          v-for="item in group.items"
          :key="item.id"
          type="button"
          class="w-full text-left px-2.5 py-1.5 rounded-md transition-colors group relative flex items-center gap-2"
          :class="item.id === activeId
            ? 'bg-primary/10'
            : 'hover:bg-base-300'"
          @click="emit('select', item.id)"
        >
          <span class="truncate text-sm flex-1 min-w-0">{{ item.title }}</span>
          <span class="text-[10px] text-base-content/40 shrink-0 tabular-nums">
            {{ formatRelativeTime(item.updatedAt) }}
          </span>
          <button
            type="button"
            class="btn btn-xs btn-ghost btn-square h-5 w-5 min-h-5 p-0 text-error opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0"
            :aria-label="t('ext.ka.chat.deleteSession')"
            @click.stop="askDelete(item)"
          >
            <Trash2 :size="12" />
          </button>
        </button>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <dialog ref="deleteDialog" class="modal">
      <div class="modal-box max-w-sm">
        <h3 class="font-semibold text-base mb-1">
          {{ t('ext.ka.chat.deleteConfirmTitle', 'Delete chat?') }}
        </h3>
        <p class="text-sm text-base-content/70">
          {{
            t('ext.ka.chat.deleteConfirmBody', '"{title}" will be permanently deleted.')
              .replace('{title}', pendingDelete?.title ?? '')
          }}
        </p>
        <div class="modal-action">
          <button class="btn btn-ghost btn-sm" type="button" @click="cancelDelete">
            {{ t('ext.ka.chat.cancel', 'Cancel') }}
          </button>
          <button class="btn btn-error btn-sm gap-1" type="button" @click="confirmDelete">
            <Trash2 :size="13" />
            {{ t('ext.ka.chat.deleteSession', 'Delete') }}
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @submit.prevent="cancelDelete" />
    </dialog>
  </aside>
</template>
