<script setup lang="ts">
import { computed, ref } from 'vue';
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

function formatRelativeTime(date: string): string {
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(date).toLocaleDateString();
}
</script>

<template>
  <aside class="flex flex-col h-full bg-base-200 border-r border-base-300">
    <div class="p-3 space-y-3 border-b border-base-300">
      <button
        class="btn btn-primary btn-sm w-full gap-1"
        @click="emit('new')"
      >
        <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
        </svg>
        {{ t('ext.ka.chat.new') }}
      </button>
      <FormInput
        v-model="search"
        :label="t('ext.ka.chat.search')"
        type="text"
      />
    </div>

    <div class="flex-1 overflow-y-auto px-2 py-2 space-y-1">
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

      <button
        v-for="item in filtered"
        :key="item.id"
        type="button"
        class="w-full text-left px-3 py-2 rounded-lg transition-colors group relative border-l-4"
        :class="item.id === activeId
          ? 'bg-primary/10 border-primary hover:bg-primary/15'
          : 'border-transparent hover:bg-base-300'"
        @click="emit('select', item.id)"
      >
        <div class="font-medium text-sm truncate pr-6">
          {{ item.title }}
        </div>
        <div class="flex items-center justify-between mt-0.5">
          <span class="text-xs text-base-content/50">
            {{ formatRelativeTime(item.updatedAt) }}
          </span>
          <button
            type="button"
            class="btn btn-xs btn-ghost text-error opacity-0 group-hover:opacity-100 focus:opacity-100 px-1"
            :aria-label="t('ext.ka.chat.deleteSession')"
            @click.stop="emit('delete', item.id)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </button>
    </div>
  </aside>
</template>