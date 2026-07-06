<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { h } from 'vue';
import { toast } from 'vue-sonner';
import { Instagram, Send, RefreshCw, MessageCircle } from 'lucide-vue-next';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import FormTextArea from '@/modules/base/ui-app/components/form/FormTextArea.vue';
import type { MyColumnDef } from '@base/ui-app/components/data-table/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const {
  getInstagramMedia,
  getInstagramComments,
  replyInstagramComment,
  sendInstagramDm,
  getInstagramConversations,
} = useUploadPost();

type Tab = 'media' | 'dms' | 'comments';

const activeTab = ref<Tab>('media');

// ─── Media ──────────────────────────────────────────────────────────────

const media = ref<unknown[]>([]);
const mediaLoading = ref(false);

async function loadMedia() {
  mediaLoading.value = true;
  try {
    const res = await getInstagramMedia();
    media.value = Array.isArray(res) ? res : ((res as Record<string, unknown>)?.data as unknown[]) ?? ((res as Record<string, unknown>)?.items as unknown[]) ?? [];
  } catch (err: unknown) {
    toast.error('Error cargando media', { description: err instanceof Error ? err.message : String(err) });
  } finally {
    mediaLoading.value = false;
  }
}

function mediaImageUrl(item: unknown): string {
  const r = item as Record<string, unknown>;
  return String(r.thumbnailUrl ?? r.mediaUrl ?? r.permalink ?? '');
}

function mediaCaption(item: unknown): string {
  const r = item as Record<string, unknown>;
  return String(r.caption ?? '');
}

function mediaDate(item: unknown): string {
  const r = item as Record<string, unknown>;
  const d = r.timestamp ?? r.createdAt ?? r.date;
  if (typeof d === 'string') {
    try { return new Date(d).toLocaleDateString(); } catch { return d; }
  }
  return '—';
}

function mediaType(item: unknown): string {
  return String((item as Record<string, unknown>).mediaType ?? (item as Record<string, unknown>).type ?? '—');
}

// ─── DMs ────────────────────────────────────────────────────────────────

interface Conversation {
  id: string;
  username: string;
  lastMessage?: string;
  timestamp?: string;
  unread?: boolean;
}

const conversations = ref<Conversation[]>([]);
const dmsLoading = ref(false);
const selectedConversation = ref<Conversation | null>(null);
const dmMessage = ref('');

function isConversation(x: unknown): x is Conversation {
  return typeof x === 'object' && x !== null && ('id' in x || 'username' in x);
}

async function loadConversations() {
  dmsLoading.value = true;
  try {
    const res = await getInstagramConversations();
    const raw = Array.isArray(res) ? res : ((res as Record<string, unknown>)?.data as unknown[]) ?? ((res as Record<string, unknown>)?.items as unknown[]) ?? [];
    conversations.value = raw.filter(isConversation).map((c) => {
      const r = c as Record<string, unknown>;
      return {
        id: String(r.id ?? r.username ?? ''),
        username: String(r.username ?? r.participant ?? '—'),
        lastMessage: typeof r.lastMessage === 'string' ? r.lastMessage : typeof r.snippet === 'string' ? r.snippet : undefined,
        timestamp: typeof r.timestamp === 'string' ? r.timestamp : typeof r.updatedAt === 'string' ? r.updatedAt : undefined,
        unread: typeof r.unread === 'boolean' ? r.unread : false,
      };
    });
  } catch (err: unknown) {
    toast.error('Error cargando conversaciones', { description: err instanceof Error ? err.message : String(err) });
  } finally {
    dmsLoading.value = false;
  }
}

const dmColumns = computed<MyColumnDef<Conversation>[]>(() => [
  {
    accessorKey: 'username',
    header: 'Usuario',
    headerName: 'Usuario',
    filterType: 'string',
    cell: ({ row }: { row: { original: Conversation } }) =>
      h('div', { class: 'flex items-center gap-2' }, [
        h(MessageCircle, { class: 'w-4 h-4 text-base-content/50' }),
        h('span', { class: 'font-medium' }, row.original.username),
      ]),
  },
  {
    accessorKey: 'lastMessage',
    header: 'Último mensaje',
    headerName: 'Último mensaje',
    filterType: 'string',
    cell: ({ row }: { row: { original: Conversation } }) =>
      h('span', { class: 'text-sm text-base-content/70 truncate max-w-xs block' }, row.original.lastMessage ?? '—'),
  },
  {
    accessorKey: 'timestamp',
    header: 'Fecha',
    headerName: 'Fecha',
    filterType: 'date',
    cell: ({ row }: { row: { original: Conversation } }) => {
      const ts = row.original.timestamp;
      if (!ts) return h('span', { class: 'text-base-content/40' }, '—');
      try {
        return h('span', { class: 'text-xs' }, new Date(ts).toLocaleString());
      } catch {
        return h('span', { class: 'text-xs' }, ts);
      }
    },
  },
  {
    id: 'actions',
    header: 'Acciones',
    headerName: 'Acciones',
    enableSorting: false,
    cell: ({ row }: { row: { original: Conversation } }) =>
      h(
        'button',
        {
          class: 'btn btn-xs btn-primary',
          onClick: (e: Event) => {
            e.stopPropagation();
            selectedConversation.value = row.original;
            dmMessage.value = '';
          },
        },
        'Responder',
      ),
  },
]);

async function handleSendDm() {
  if (!selectedConversation.value) return;
  if (!dmMessage.value.trim()) {
    toast.error('Escribe un mensaje');
    return;
  }
  try {
    await sendInstagramDm(selectedConversation.value.username, dmMessage.value.trim());
    toast.success('DM enviado', { description: `A @${selectedConversation.value.username}` });
    dmMessage.value = '';
    selectedConversation.value = null;
    await loadConversations();
  } catch (err: unknown) {
    toast.error('Error enviando DM', { description: err instanceof Error ? err.message : String(err) });
  }
}

// ─── Comments ───────────────────────────────────────────────────────────

const commentsPostUrl = ref('');
const comments = ref<unknown[]>([]);
const commentsLoading = ref(false);
const replyingTo = ref<{ commentId: string; username: string } | null>(null);
const replyMessage = ref('');

async function loadComments() {
  if (!commentsPostUrl.value.trim()) {
    toast.error('Ingresa la URL del post');
    return;
  }
  commentsLoading.value = true;
  try {
    const res = await getInstagramComments(commentsPostUrl.value.trim());
    comments.value = Array.isArray(res) ? res : ((res as Record<string, unknown>)?.data as unknown[]) ?? ((res as Record<string, unknown>)?.items as unknown[]) ?? [];
  } catch (err: unknown) {
    toast.error('Error cargando comentarios', { description: err instanceof Error ? err.message : String(err) });
  } finally {
    commentsLoading.value = false;
  }
}

async function handleReply() {
  if (!replyingTo.value) return;
  if (!replyMessage.value.trim()) {
    toast.error('Escribe la respuesta');
    return;
  }
  try {
    await replyInstagramComment(replyingTo.value.commentId, replyMessage.value.trim());
    toast.success('Respuesta enviada');
    replyMessage.value = '';
    replyingTo.value = null;
    await loadComments();
  } catch (err: unknown) {
    toast.error('Error respondiendo comentario', { description: err instanceof Error ? err.message : String(err) });
  }
}

onMounted(() => {
  loadMedia();
  loadConversations();
});
</script>

<template>
  <div class="p-6 space-y-6 max-w-5xl mx-auto">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold flex items-center gap-2">
        <Instagram class="w-6 h-6" />
        Instagram
      </h1>
      <button class="btn btn-ghost btn-sm" @click="[loadMedia(), loadConversations()]">
        <RefreshCw class="w-4 h-4" />
        Actualizar
      </button>
    </div>

    <!-- Tabs -->
    <div role="tablist" class="tabs tabs-boxed">
      <button
        role="tab"
        class="tab"
        :class="{ 'tab-active': activeTab === 'media' }"
        @click="activeTab = 'media'"
      >
        Media
      </button>
      <button
        role="tab"
        class="tab"
        :class="{ 'tab-active': activeTab === 'dms' }"
        @click="activeTab = 'dms'"
      >
        DMs
      </button>
      <button
        role="tab"
        class="tab"
        :class="{ 'tab-active': activeTab === 'comments' }"
        @click="activeTab = 'comments'"
      >
        Comentarios
      </button>
    </div>

    <!-- Media tab -->
    <div v-if="activeTab === 'media'">
      <div v-if="mediaLoading" class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg" />
      </div>
      <div v-else-if="media.length === 0" class="text-center py-12 text-base-content/50">
        Sin media disponible
      </div>
      <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div
          v-for="(item, i) in media"
          :key="i"
          class="card bg-base-100 shadow-sm border border-base-300 overflow-hidden"
        >
          <figure v-if="mediaImageUrl(item)" class="aspect-square bg-base-200">
            <img :src="mediaImageUrl(item)" :alt="mediaCaption(item)" class="w-full h-full object-cover" >
          </figure>
          <div class="card-body p-3">
            <span class="badge badge-sm badge-ghost capitalize">{{ mediaType(item) }}</span>
            <p class="text-xs text-base-content/70 line-clamp-2">{{ mediaCaption(item) || '—' }}</p>
            <p class="text-xs text-base-content/40">{{ mediaDate(item) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- DMs tab -->
    <div v-if="activeTab === 'dms'">
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body p-6">
          <div v-if="dmsLoading" class="flex justify-center py-8">
            <span class="loading loading-spinner loading-md" />
          </div>
          <div v-else-if="conversations.length === 0" class="text-center py-8 text-base-content/50">
            Sin conversaciones
          </div>
          <DataTable
            v-else
            :columns="dmColumns"
            :data="conversations"
            :total="conversations.length"
            manual
            table-name="instagram-dms"
          />
        </div>
      </div>

      <!-- Reply DM modal -->
      <dialog class="modal" :class="{ 'modal-open': !!selectedConversation }">
        <div class="modal-box max-w-md">
          <h3 class="font-bold text-lg mb-2">Enviar DM</h3>
          <p class="text-sm text-base-content/70 mb-3">
            Para: <span class="font-medium">@{{ selectedConversation?.username }}</span>
          </p>
          <FormTextArea
            v-model="dmMessage"
            label="Mensaje"
            placeholder="Escribe tu mensaje..."
            :rows="4"
          />
          <div class="modal-action">
            <button class="btn" @click="selectedConversation = null">Cancelar</button>
            <button class="btn btn-primary" @click="handleSendDm">
              <Send class="w-4 h-4" />
              Enviar
            </button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop" @click="selectedConversation = null">
          <button>close</button>
        </form>
      </dialog>
    </div>

    <!-- Comments tab -->
    <div v-if="activeTab === 'comments'">
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body p-6 space-y-4">
          <h2 class="text-lg font-semibold">Comentarios por post</h2>
          <div class="flex gap-2">
            <input
              v-model="commentsPostUrl"
              class="input input-bordered flex-1"
              placeholder="https://instagram.com/p/Cxxxx"
            >
            <button
              class="btn btn-primary btn-sm"
              :disabled="commentsLoading"
              @click="loadComments"
            >
              <span v-if="commentsLoading" class="loading loading-spinner loading-xs" />
              Cargar
            </button>
          </div>

          <div v-if="commentsLoading" class="flex justify-center py-6">
            <span class="loading loading-spinner loading-md" />
          </div>

          <div v-else-if="comments.length === 0" class="text-center py-6 text-base-content/50">
            Sin comentarios cargados
          </div>

          <ul v-else class="space-y-2">
            <li
              v-for="(c, i) in comments"
              :key="i"
              class="p-3 rounded-lg border border-base-200"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1">
                  <p class="font-medium text-sm">@{{ (c as Record<string, unknown>).username ?? '—' }}</p>
                  <p class="text-sm text-base-content/70">{{ (c as Record<string, unknown>).text ?? (c as Record<string, unknown>).comment ?? '—' }}</p>
                </div>
                <button
                  class="btn btn-xs btn-outline"
                  @click="replyingTo = { commentId: String((c as Record<string, unknown>).id ?? (c as Record<string, unknown>).commentId), username: String((c as Record<string, unknown>).username ?? '') }; replyMessage = ''"
                >
                  Responder
                </button>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <!-- Reply comment modal -->
      <dialog class="modal" :class="{ 'modal-open': !!replyingTo }">
        <div class="modal-box max-w-md">
          <h3 class="font-bold text-lg mb-2">Responder comentario</h3>
          <p class="text-sm text-base-content/70 mb-3">
            @{{ replyingTo?.username }}
          </p>
          <FormTextArea
            v-model="replyMessage"
            label="Respuesta"
            placeholder="Escribe tu respuesta..."
            :rows="3"
          />
          <div class="modal-action">
            <button class="btn" @click="replyingTo = null">Cancelar</button>
            <button class="btn btn-primary" @click="handleReply">
              <Send class="w-4 h-4" />
              Enviar
            </button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop" @click="replyingTo = null">
          <button>close</button>
        </form>
      </dialog>
    </div>
  </div>
</template>