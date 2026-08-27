<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { AlertTriangle, Copy, Trash2, X, ChevronDown, ChevronRight } from 'lucide-vue-next';
import { toast } from 'vue-sonner';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
  title: 'Error Log',
});

const { t } = useI18n();

interface ErrorEntry {
  id: string;
  message: string;
  source?: string;
  stack?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  userAgent?: string;
  url?: string;
  method?: string;
  statusCode?: number;
  requestBody?: unknown;
  requestHeaders?: Record<string, string>;
}

const errors = ref<ErrorEntry[]>([]);
const loading = ref(false);
const expandedId = ref<string | null>(null);
const filter = ref('');
const sourceFilter = ref<string | null>(null);

const filtered = computed<ErrorEntry[]>(() => {
  let list = errors.value;
  if (sourceFilter.value) {
    list = list.filter((e) => e.source === sourceFilter.value);
  }
  const q = filter.value.trim().toLowerCase();
  if (q) {
    list = list.filter((e) =>
      e.message.toLowerCase().includes(q) ||
      (e.stack ?? '').toLowerCase().includes(q) ||
      (e.source ?? '').toLowerCase().includes(q)
    );
  }
  return list;
});

const sources = computed(() => {
  const set = new Set<string>();
  for (const e of errors.value) {
    if (e.source) set.add(e.source);
  }
  return [...set].sort();
});

async function fetchErrors(): Promise<void> {
  loading.value = true;
  try {
    const data = await useErrors().fetchErrors();
    errors.value = (data ?? []).map((e: Record<string, unknown>) => ({
      id: String(e.id ?? ''),
      message: String(e.message ?? ''),
      source: e.source ? String(e.source) : undefined,
      stack: e.stack ? String(e.stack) : undefined,
      metadata: (e.metadata as Record<string, unknown>) ?? undefined,
      createdAt: String(e.createdAt ?? ''),
      userAgent: e.userAgent ? String(e.userAgent) : undefined,
      url: e.url ? String(e.url) : undefined,
      method: e.method ? String(e.method) : undefined,
      statusCode: e.statusCode ? Number(e.statusCode) : undefined,
      requestBody: e.requestBody,
      requestHeaders: e.requestHeaders as Record<string, string> | undefined,
    }));
  } catch {
    // silent
  } finally {
    loading.value = false;
  }
}

function toggleExpand(id: string): void {
  expandedId.value = expandedId.value === id ? null : id;
}

function copyError(err: ErrorEntry): void {
  const text = [
    `Message: ${err.message}`,
    `Source: ${err.source ?? 'N/A'}`,
    `Time: ${err.createdAt}`,
    `Stack: ${err.stack ?? 'N/A'}`,
    `URL: ${err.url ?? 'N/A'}`,
    `Method: ${err.method ?? 'N/A'}`,
    `Status: ${err.statusCode ?? 'N/A'}`,
    `User-Agent: ${err.userAgent ?? 'N/A'}`,
    `Request Body: ${err.requestBody ? JSON.stringify(err.requestBody, null, 2) : 'N/A'}`,
    `Metadata: ${err.metadata ? JSON.stringify(err.metadata, null, 2) : 'N/A'}`,
  ].join('\n');
  navigator.clipboard.writeText(text).then(() => {
    toast.success(t('mod.nav.copied', 'Copied'));
  });
}

async function deleteError(id: string): Promise<void> {
  try {
    await useErrors().deleteError(id);
    errors.value = errors.value.filter((e) => e.id !== id);
  } catch {
    // silent
  }
}

async function clearAll(): Promise<void> {
  try {
    await useErrors().clearErrors();
    errors.value = [];
    toast.success(t('mod.nav.errorsCleared', 'Errors cleared'));
  } catch {
    // silent
  }
}

function formatTime(ts: string): string {
  if (!ts || ts === 'Invalid Date') return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

onMounted(fetchErrors);
</script>

<template>
  <div class="p-6 space-y-4">
    <header class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold inline-flex items-center gap-2">
          <AlertTriangle :size="22" class="text-error" />
          {{ t('mod.nav.errorLog', 'Error Log') }}
        </h1>
        <p class="text-base-content/60 text-sm">
          {{ errors.length }} {{ t('mod.nav.errorsLogged', 'errors logged') }}
        </p>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-sm btn-ghost" @click="fetchErrors">
          {{ t('mod.nav.refresh', 'Refresh') }}
        </button>
        <button
          v-if="errors.length > 0"
          class="btn btn-sm btn-ghost text-error gap-1"
          @click="clearAll"
        >
          <Trash2 :size="13" />
          {{ t('mod.nav.clearErrors', 'Clear all') }}
        </button>
      </div>
    </header>

    <!-- Filters -->
    <div class="flex gap-2 items-center">
      <input
        v-model="filter"
        type="text"
        :placeholder="t('mod.nav.searchErrors', 'Search errors…')"
        class="input input-sm input-bordered flex-1"
      >
      <select
        v-model="sourceFilter"
        class="select select-sm select-bordered"
      >
        <option :value="null">All sources</option>
        <option v-for="s in sources" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>

    <!-- Error list -->
    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg" />
    </div>
    <div v-else-if="filtered.length === 0" class="text-center py-12 text-base-content/40">
      {{ t('mod.nav.noErrors', 'No errors') }}
    </div>
    <div v-else class="space-y-2">
      <div
        v-for="err in filtered"
        :key="err.id"
        class="card bg-base-100 border border-base-300 rounded-lg overflow-hidden"
      >
        <!-- Header row -->
        <div
          class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-base-200"
          @click="toggleExpand(err.id)"
        >
          <component
            :is="expandedId === err.id ? ChevronDown : ChevronRight"
            :size="14"
            class="shrink-0 text-base-content/40"
          />
          <span
            class="badge badge-sm shrink-0"
            :class="err.source?.includes('Vue') ? 'badge-warning' : err.source?.includes('HTTP') ? 'badge-info' : 'badge-error'"
          >
            {{ err.source ?? 'Unknown' }}
          </span>
          <span class="flex-1 min-w-0 truncate text-sm font-mono text-error">
            {{ err.message }}
          </span>
          <span class="text-xs text-base-content/40 shrink-0">{{ formatTime(err.createdAt) }}</span>
          <button
            class="btn btn-xs btn-ghost btn-square h-6 w-6"
            :aria-label="t('mod.nav.copyError', 'Copy error')"
            @click.stop="copyError(err)"
          >
            <Copy :size="11" />
          </button>
          <button
            class="btn btn-xs btn-ghost btn-square h-6 w-6 text-error"
            :aria-label="t('mod.nav.deleteError', 'Delete error')"
            @click.stop="deleteError(err.id)"
          >
            <X :size="11" />
          </button>
        </div>

        <!-- Expanded detail -->
        <div v-if="expandedId === err.id" class="border-t border-base-300 p-3 space-y-3 text-sm">
          <div v-if="err.stack">
            <div class="text-xs font-semibold text-base-content/50 uppercase mb-1">Stack Trace</div>
            <pre class="bg-base-200 p-2 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap">{{ err.stack }}</pre>
          </div>
          <div v-if="err.url || err.method || err.statusCode" class="grid grid-cols-3 gap-2 text-xs">
            <div v-if="err.method">
              <span class="text-base-content/50">Method:</span>
              <code class="ml-1 bg-base-200 px-1 rounded">{{ err.method }}</code>
            </div>
            <div v-if="err.statusCode">
              <span class="text-base-content/50">Status:</span>
              <code class="ml-1 bg-base-200 px-1 rounded">{{ err.statusCode }}</code>
            </div>
            <div v-if="err.url">
              <span class="text-base-content/50">URL:</span>
              <code class="ml-1 bg-base-200 px-1 rounded break-all">{{ err.url }}</code>
            </div>
          </div>
          <div v-if="err.requestBody">
            <div class="text-xs font-semibold text-base-content/50 uppercase mb-1">Request Body</div>
            <pre class="bg-base-200 p-2 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap">{{ JSON.stringify(err.requestBody, null, 2) }}</pre>
          </div>
          <div v-if="err.metadata">
            <div class="text-xs font-semibold text-base-content/50 uppercase mb-1">Metadata</div>
            <pre class="bg-base-200 p-2 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap">{{ JSON.stringify(err.metadata, null, 2) }}</pre>
          </div>
          <div v-if="err.userAgent">
            <div class="text-xs font-semibold text-base-content/50 uppercase mb-1">User Agent</div>
            <code class="text-xs bg-base-200 px-1 py-0.5 rounded break-all">{{ err.userAgent }}</code>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>