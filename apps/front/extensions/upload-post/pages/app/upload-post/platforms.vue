<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { toast } from 'vue-sonner';
import { Share2, RefreshCw, CheckCircle2 } from 'lucide-vue-next';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const {
  getFacebookPages,
  getLinkedinPages,
  getPinterestBoards,
  getGoogleBusinessLocations,
  selectGoogleBusinessLocation,
  getRedditDetailedPost,
} = useUploadPost();

type PlatformKey = 'facebook' | 'linkedin' | 'pinterest' | 'google-business' | 'reddit';

interface PlatformState {
  items: unknown[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
}

const states = ref<Record<PlatformKey, PlatformState>>({
  facebook: { items: [], loading: false, error: null, selectedId: null },
  linkedin: { items: [], loading: false, error: null, selectedId: null },
  pinterest: { items: [], loading: false, error: null, selectedId: null },
  'google-business': { items: [], loading: false, error: null, selectedId: null },
  reddit: { items: [], loading: false, error: null, selectedId: null },
});

const PLATFORM_META: Record<PlatformKey, { label: string; icon: string; color: string }> = {
  facebook: { label: 'Facebook', icon: 'Facebook', color: 'text-blue-600' },
  linkedin: { label: 'LinkedIn', icon: 'Linkedin', color: 'text-blue-700' },
  pinterest: { label: 'Pinterest', icon: 'Image', color: 'text-red-600' },
  'google-business': { label: 'Google Business', icon: 'MapPin', color: 'text-green-600' },
  reddit: { label: 'Reddit', icon: 'MessageSquare', color: 'text-orange-600' },
};

const redditPostId = ref('');
const redditDetail = ref<Record<string, unknown> | null>(null);
const redditLoading = ref(false);

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function loadPlatform(key: PlatformKey) {
  const s = states.value[key];
  s.loading = true;
  s.error = null;
  try {
    let res: unknown;
    if (key === 'facebook') res = await getFacebookPages();
    else if (key === 'linkedin') res = await getLinkedinPages();
    else if (key === 'pinterest') res = await getPinterestBoards();
    else if (key === 'google-business') res = await getGoogleBusinessLocations();
    else return; // reddit handled separately

    s.items = Array.isArray(res) ? res : ((res as Record<string, unknown>)?.items as unknown[]) ?? ((res as Record<string, unknown>)?.data as unknown[]) ?? [];
  } catch (err: unknown) {
    s.error = errorMessage(err);
    toast.error(`Error cargando ${PLATFORM_META[key].label}`, { description: s.error });
  } finally {
    s.loading = false;
  }
}

async function handleSelectGoogleLocation(locationId: string) {
  try {
    await selectGoogleBusinessLocation(locationId);
    states.value['google-business'].selectedId = locationId;
    toast.success('Ubicación de Google Business seleccionada');
  } catch (err: unknown) {
    toast.error('Error seleccionando ubicación', { description: errorMessage(err) });
  }
}

async function handleLoadRedditPost() {
  if (!redditPostId.value.trim()) {
    toast.error('Ingresa un Post ID');
    return;
  }
  redditLoading.value = true;
  try {
    const res = await getRedditDetailedPost(redditPostId.value.trim());
    redditDetail.value = res as Record<string, unknown>;
  } catch (err: unknown) {
    toast.error('Error cargando post de Reddit', { description: errorMessage(err) });
  } finally {
    redditLoading.value = false;
  }
}

function itemLabel(item: unknown): string {
  const r = item as Record<string, unknown>;
  return String(r.name ?? r.title ?? r.id ?? r.locationName ?? '—');
}

function itemDescription(item: unknown): string {
  const r = item as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof r.id === 'string') parts.push(`ID: ${r.id}`);
  if (typeof r.followers === 'number') parts.push(`Followers: ${r.followers}`);
  if (typeof r.category === 'string') parts.push(r.category);
  if (typeof r.address === 'string') parts.push(r.address);
  if (typeof r.url === 'string') parts.push(r.url);
  return parts.join(' · ');
}

const PLATFORM_KEYS: PlatformKey[] = ['facebook', 'linkedin', 'pinterest', 'google-business', 'reddit'];

onMounted(() => {
  PLATFORM_KEYS.filter((k) => k !== 'reddit').forEach(loadPlatform);
});
</script>

<template>
  <div class="p-6 space-y-6 max-w-5xl mx-auto">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold flex items-center gap-2">
        <Share2 class="w-6 h-6" />
        Plataformas
      </h1>
    </div>

    <!-- Platform cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div
        v-for="key in PLATFORM_KEYS.filter(k => k !== 'reddit')"
        :key="key"
        class="card bg-base-100 shadow-sm border border-base-300"
      >
        <div class="card-body p-5">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-lg font-semibold">{{ PLATFORM_META[key].label }}</h2>
            <button class="btn btn-ghost btn-xs" @click="loadPlatform(key)">
              <RefreshCw class="w-3.5 h-3.5" />
            </button>
          </div>

          <div v-if="states[key].loading" class="flex justify-center py-6">
            <span class="loading loading-spinner loading-sm" />
          </div>

          <div v-else-if="states[key].error" class="text-sm text-error py-4">
            {{ states[key].error }}
          </div>

          <div v-else-if="states[key].items.length === 0" class="text-sm text-base-content/50 py-4">
            Sin páginas / boards disponibles
          </div>

          <ul v-else class="space-y-2">
            <li
              v-for="(item, i) in states[key].items"
              :key="i"
              class="flex items-start justify-between gap-3 p-3 rounded-lg border border-base-200"
            >
              <div class="flex-1 min-w-0">
                <p class="font-medium text-sm truncate">{{ itemLabel(item) }}</p>
                <p class="text-xs text-base-content/60 truncate">{{ itemDescription(item) }}</p>
              </div>
              <button
                v-if="key === 'google-business'"
                class="btn btn-xs"
                :class="states[key].selectedId === (item as Record<string, unknown>).id ? 'btn-success' : 'btn-outline'"
                @click="handleSelectGoogleLocation(String((item as Record<string, unknown>).id))"
              >
                <CheckCircle2 v-if="states[key].selectedId === (item as Record<string, unknown>).id" class="w-3 h-3" />
                {{ states[key].selectedId === (item as Record<string, unknown>).id ? 'Seleccionada' : 'Seleccionar' }}
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Reddit detailed post -->
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6 space-y-3">
        <h2 class="text-lg font-semibold">{{ PLATFORM_META.reddit.label }} — Post detallado</h2>
        <div class="flex gap-2">
          <input
            v-model="redditPostId"
            class="input input-bordered flex-1"
            placeholder="Post ID (ej: 1a2b3c)"
          >
          <button
            class="btn btn-primary btn-sm"
            :disabled="redditLoading"
            @click="handleLoadRedditPost"
          >
            <span v-if="redditLoading" class="loading loading-spinner loading-xs" />
            Buscar
          </button>
        </div>

        <div v-if="redditDetail" class="mockup-code text-xs">
          <pre>{{ JSON.stringify(redditDetail, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>