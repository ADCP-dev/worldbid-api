<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { Inbox, Send, MessageCircle, Bot } from 'lucide-vue-next';
import PageShell from '@upload-post/components/PageShell.vue';
import EmptyState from '@base/ui-app/components/dashboard/EmptyState.vue';
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import {
  useDmConversationsQuery,
  useSendDmMutation,
  useInstagramCommentsQuery,
  useInstagramCommentReplyMutation,
  useAutodmStatusQuery,
  useAutodmLogsQuery,
  useAutodmActionMutation,
  useStartAutodmMutation,
} from '@upload-post/composables/useUploadPostApi';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const { t } = useI18n();

type TabId = 'dms' | 'comments' | 'autodm';
const activeTab = ref<TabId>('dms');

// ─── DMs ──────────────────────────────────────────────────────────────

const conversationsQuery = useDmConversationsQuery();
const conversations = computed(() => conversationsQuery.data.value ?? []);

const selectedIdx = ref(0);
const selected = computed(() => conversations.value[selectedIdx.value] ?? null);
const dmDraft = ref('');

const sendDm = useSendDmMutation();

async function onSendDm() {
  const convo = selected.value;
  if (!convo?.username || dmDraft.value.trim() === '') return;
  try {
    await sendDm.mutateAsync({ username: convo.username, message: dmDraft.value });
    dmDraft.value = '';
    toast.success(t('ext.upload-post.inbox.dmSent'));
  } catch (err: unknown) {
    // Upstream cause MUST surface (24h window etc.) — spec instagram-inbox.
    toast.error(
      err instanceof Error ? err.message : t('ext.upload-post.common.requestFailed'),
      { duration: 8000 },
    );
  }
}

// ─── Comments ─────────────────────────────────────────────────────────

const commentsPostUrl = ref('');
const commentsQuery = useInstagramCommentsQuery(
  computed(() => commentsPostUrl.value),
);
const comments = computed(() => commentsQuery.data.value ?? []);
const replyDraft = ref<Record<string, string>>({});


async function onReply(commentId: string) {
  const message = replyDraft.value[commentId]?.trim();
  if (!message) return;
  try {
    await replyDraftMutation.mutateAsync({ commentId, message });
    replyDraft.value = { ...replyDraft.value, [commentId]: '' };
    toast.success(t('ext.upload-post.inbox.replySent'));
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : t('ext.upload-post.common.requestFailed'));
  }
}

const replyDraftMutation = useInstagramCommentReplyMutation();

// ─── AutoDM ───────────────────────────────────────────────────────────

const autodmQuery = useAutodmStatusQuery();
const monitors = computed(() => autodmQuery.data.value ?? []);

const autodmAction = useAutodmActionMutation();

const showStartModal = ref(false);
const startForm = ref({
  postUrl: '',
  replyMessage: '',
  monitoringInterval: 60,
  triggerKeywords: '',
});

const startAutodm = useStartAutodmMutation();

async function onStartAutodm() {
  try {
    await startAutodm.mutateAsync({
      postUrl: startForm.value.postUrl,
      replyMessage: startForm.value.replyMessage,
      monitoringInterval: startForm.value.monitoringInterval,
      triggerKeywords: startForm.value.triggerKeywords
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0),
    });
    showStartModal.value = false;
    startForm.value = { postUrl: '', replyMessage: '', monitoringInterval: 60, triggerKeywords: '' };
    toast.success(t('ext.upload-post.inbox.autodmStarted'));
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : t('ext.upload-post.common.requestFailed'));
  }
}

async function onAutodmAction(action: 'pause' | 'resume' | 'stop' | 'delete', monitorId: string) {
  try {
    await autodmAction.mutateAsync({ action, monitorId });
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : t('ext.upload-post.common.requestFailed'));
  }
}

// Logs drawer
const logsMonitorId = ref<string | null>(null);
const logsQuery = useAutodmLogsQuery(
  computed(() => logsMonitorId.value ?? ''),
);
const monitorId = (m: typeof monitors.value[number]) => m.monitor_id ?? m.monitorId ?? '';

const statusBadge = (s?: string) =>
  s === 'running'
    ? 'badge-success'
    : s === 'paused'
      ? 'badge-warning'
      : 'badge-ghost';
</script>

<template>
  <PageShell
    :title="t('ext.upload-post.pages.inbox.title')"
    :subtitle="t('ext.upload-post.pages.inbox.subtitle')"
    :icon="Inbox"
    :loading="conversationsQuery.isLoading.value"
  >
    <div class="space-y-6">
      <div role="tablist" class="tabs tabs-box w-fit">
        <button role="tab" class="tab" :class="activeTab === 'dms' ? 'tab-active' : ''" @click="activeTab = 'dms'">
          {{ t('ext.upload-post.inbox.dmsTab') }}
        </button>
        <button role="tab" class="tab" :class="activeTab === 'comments' ? 'tab-active' : ''" @click="activeTab = 'comments'">
          {{ t('ext.upload-post.inbox.commentsTab') }}
        </button>
        <button role="tab" class="tab" :class="activeTab === 'autodm' ? 'tab-active' : ''" @click="activeTab = 'autodm'">
          {{ t('ext.upload-post.inbox.autodmTab') }}
        </button>
      </div>

      <!-- DMs -->
      <div v-show="activeTab === 'dms'" class="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div class="card bg-base-100 border border-base-300">
          <div class="card-body p-3 gap-2 overflow-y-auto max-h-[60vh]">
            <button
              v-for="(c, i) in conversations"
              :key="c.id ?? c.username ?? i"
              type="button"
              class="flex items-center gap-3 rounded-lg p-2 text-left"
              :class="i === selectedIdx ? 'bg-primary/10' : 'hover:bg-base-200'"
              @click="selectedIdx = i"
            >
              <MessageCircle class="h-4 w-4 text-base-content/50" aria-hidden="true" />
              <span class="min-w-0">
                <span class="block font-medium truncate">{{ c.username }}</span>
                <span class="block text-xs text-base-content/50 truncate">
                  {{ c.last_message ?? '' }}
                </span>
              </span>
            </button>
            <EmptyState
              v-if="conversations.length === 0 && !conversationsQuery.isLoading.value"
              :icon="Inbox"
              :title="t('ext.upload-post.inbox.noConversations')"
              size="sm"
            />
          </div>
        </div>

        <div class="card bg-base-100 border border-base-300">
          <div class="card-body gap-4">
            <template v-if="selected">
              <div class="space-y-2 overflow-y-auto max-h-[45vh]">
                <div
                  v-for="(msg, i) in selected.messages ?? []"
                  :key="msg.id ?? i"
                  class="chat"
                  :class="(msg.from ?? '') === 'me' ? 'chat-end' : 'chat-start'"
                >
                  <div class="chat-bubble">
                    {{ msg.text }}
                  </div>
                </div>
                <p
                  v-if="(selected.messages ?? []).length === 0"
                  class="text-sm text-base-content/50"
                >
                  {{ t('ext.upload-post.inbox.noMessages') }}
                </p>
              </div>
              <div class="space-y-2">
                <FormTextArea v-model="dmDraft" :rows="3" />
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  :disabled="sendDm.isPending.value"
                  @click="onSendDm"
                >
                  <Send class="h-4 w-4" aria-hidden="true" />
                  {{ t('ext.upload-post.inbox.send') }}
                </button>
                <p class="text-xs text-base-content/50">
                  {{ t('ext.upload-post.inbox.window24hNotice') }}
                </p>
              </div>
            </template>
            <EmptyState
              v-else
              :icon="Inbox"
              :title="t('ext.upload-post.inbox.pickConversation')"
            />
          </div>
        </div>
      </div>

      <!-- Comments -->
      <div v-show="activeTab === 'comments'" class="space-y-4">
        <div class="flex gap-2 max-w-2xl">
          <FormInput
            v-model="commentsPostUrl"
            :placeholder="t('ext.upload-post.inbox.postUrlPlaceholder')"
            class="flex-1"
          />
        </div>
        <ul class="space-y-3">
          <li
            v-for="c in comments"
            :key="c.id"
            class="card bg-base-100 border border-base-300"
          >
            <div class="card-body p-4 gap-2">
              <div class="flex items-center gap-2">
                <span class="font-medium">{{ c.username }}</span>
                <span v-if="c.created_at" class="text-xs text-base-content/50">
                  {{ new Date(c.created_at ?? '').toLocaleString() }}
                </span>
              </div>
              <p class="text-sm">{{ c.text }}</p>
              <div class="flex items-end gap-2">
                <FormTextArea v-model="replyDraft[c.id]" :rows="1" class="flex-1" />
                <button
                  type="button"
                  class="btn btn-outline btn-sm"
                  :disabled="replyDraft[c.id]?.trim().length === 0"
                  @click="onReply(c.id)"
                >
                  {{ t('ext.upload-post.inbox.reply') }}
                </button>
              </div>
              <ul v-if="c.replies?.length" class="ml-6 mt-2 space-y-1 border-l border-base-300 pl-4">
                <li v-for="r in c.replies" :key="r.id" class="text-sm">
                  <span class="font-medium">{{ r.username }}:</span> {{ r.text }}
                </li>
              </ul>
            </div>
          </li>
        </ul>
        <EmptyState
          v-if="commentsPostUrl.length > 0 && comments.length === 0 && !commentsQuery.isLoading.value"
          :icon="MessageCircle"
          :title="t('ext.upload-post.common.noData')"
        />
      </div>

      <!-- AutoDM -->
      <div v-show="activeTab === 'autodm'" class="space-y-4">
        <div class="flex justify-end">
          <button type="button" class="btn btn-primary btn-sm" @click="showStartModal = true">
            <Bot class="h-4 w-4" aria-hidden="true" />
            {{ t('ext.upload-post.inbox.startAutodm') }}
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>{{ t('ext.upload-post.inbox.postUrl') }}</th>
                <th>{{ t('ext.upload-post.inbox.status') }}</th>
                <th>{{ t('ext.upload-post.inbox.dmsSent') }}</th>
                <th>{{ t('ext.upload-post.inbox.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in monitors" :key="monitorId(m)">
                <td class="max-w-xs truncate">{{ m.post_url ?? m.postUrl }}</td>
                <td>
                  <span class="badge badge-sm" :class="statusBadge(m.status)">
                    {{ m.status }}
                  </span>
                </td>
                <td>{{ m.dms_sent ?? m.dmsSent ?? 0 }}</td>
                <td class="flex flex-wrap gap-1">
                  <button
                    v-if="m.status === 'running'"
                    type="button"
                    class="btn btn-ghost btn-xs"
                    @click="onAutodmAction('pause', monitorId(m))"
                  >
                    {{ t('ext.upload-post.inbox.pause') }}
                  </button>
                  <button
                    v-if="m.status === 'paused'"
                    type="button"
                    class="btn btn-ghost btn-xs"
                    @click="onAutodmAction('resume', monitorId(m))"
                  >
                    {{ t('ext.upload-post.inbox.resume') }}
                  </button>
                  <button
                    v-if="m.status !== 'stopped'"
                    type="button"
                    class="btn btn-ghost btn-xs text-warning"
                    @click="onAutodmAction('stop', monitorId(m))"
                  >
                    {{ t('ext.upload-post.inbox.stop') }}
                  </button>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs text-error"
                    @click="onAutodmAction('delete', monitorId(m))"
                  >
                    {{ t('ext.upload-post.common.delete') }}
                  </button>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    @click="logsMonitorId = monitorId(m)"
                  >
                    {{ t('ext.upload-post.inbox.logs') }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Logs drawer -->
        <div
          v-if="logsMonitorId"
          class="card bg-base-100 border border-base-300"
        >
          <div class="card-body p-4 gap-2">
            <div class="flex items-center justify-between">
              <h4 class="font-semibold">{{ t('ext.upload-post.inbox.logs') }}</h4>
              <button type="button" class="btn btn-ghost btn-xs" @click="logsMonitorId = null">
                {{ t('ext.upload-post.common.close') }}
              </button>
            </div>
            <ul class="text-xs font-mono space-y-1 max-h-64 overflow-y-auto">
              <li v-for="(log, i) in logsQuery.data.value ?? []" :key="i">
                <span class="text-base-content/50">{{ log.timestamp ?? '' }}</span>
                {{ log.message ?? log.event ?? '' }}
              </li>
              <li v-if="(logsQuery.data.value ?? []).length === 0" class="text-base-content/50">
                {{ t('ext.upload-post.common.noData') }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Start AutoDM modal -->
    <dialog class="modal" :open="showStartModal">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">
          {{ t('ext.upload-post.inbox.startAutodm') }}
        </h3>
        <div class="space-y-4">
          <FormInput
            v-model="startForm.postUrl"
            :label="t('ext.upload-post.inbox.postUrl')"
            placeholder="https://instagram.com/p/..."
          />
          <FormTextArea
            v-model="startForm.replyMessage"
            :label="t('ext.upload-post.inbox.replyMessage')"
            :rows="3"
          />
          <FormInput
            v-model="startForm.triggerKeywords"
            :label="t('ext.upload-post.inbox.keywords')"
            placeholder="kw1, kw2"
          />
          <FormInput
            v-model.number="startForm.monitoringInterval"
            type="number"
            :label="t('ext.upload-post.inbox.interval')"
          />
        </div>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="showStartModal = false">
            {{ t('ext.upload-post.common.cancel') }}
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="startAutodm.isPending.value"
            @click="onStartAutodm"
          >
            {{ t('ext.upload-post.common.save') }}
          </button>
        </div>
      </div>
      <button type="button" class="modal-backdrop" @click="showStartModal = false" />
    </dialog>
  </PageShell>
</template>