<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { toast } from 'vue-sonner';
import { z } from 'zod';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';
import type {
  Draft,
  Idea,
  MetricsSnapshot,
  PaginatedResponse,
  Project,
  ProjectMetrics,
  UpdateProjectPayload,
} from '@/extensions/content-pipeline/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const route = useRoute();
const cp = useContentPipeline();

const projectId = computed(() => route.params.id as string);

const loading = ref(false);
const saving = ref(false);
const project = ref<Project | null>(null);
const metrics = ref<ProjectMetrics | MetricsSnapshot[] | null>(null);
const ideas = ref<Idea[]>([]);
const drafts = ref<Draft[]>([]);
const activeTab = ref<'ideas' | 'drafts' | 'metrics' | 'settings'>('ideas');

const languageOptions = [
  { label: 'English', value: 'en' },
  { label: 'Español', value: 'es' },
];

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Paused', value: 'paused' },
  { label: 'Archived', value: 'archived' },
];

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase, alphanumeric, with hyphens'),
  niche: z.string().min(2, 'Niche is required'),
  brandVoice: z.string().optional().default(''),
  targetAudience: z.string().optional().default(''),
  description: z.string().optional().default(''),
  language: z.enum(['en', 'es']).default('en'),
  status: z.enum(['active', 'paused', 'archived']).default('active'),
  autoPublishBlog: z.boolean().default(false),
  autoPublishSocial: z.boolean().default(false),
});

type FormValues = z.infer<typeof schema>;

const form = ref<FormValues>({
  name: '',
  slug: '',
  niche: '',
  brandVoice: '',
  targetAudience: '',
  description: '',
  language: 'en',
  status: 'active',
  autoPublishBlog: false,
  autoPublishSocial: false,
});

const errors = ref<Partial<Record<keyof FormValues, string>>>({});

const metricsBars = computed(() => {
  const m = metrics.value;
  if (!m || Array.isArray(m)) return [];
  const items = [
    { label: 'Ideas', value: m.totalIdeas ?? 0, color: 'bg-info' },
    { label: 'Approved', value: m.approvedIdeas ?? 0, color: 'bg-success' },
    { label: 'Drafts', value: m.totalDrafts ?? 0, color: 'bg-warning' },
    { label: 'Published', value: m.publishedDrafts ?? 0, color: 'bg-primary' },
  ];
  const max = Math.max(...items.map((i) => i.value), 1);
  return items.map((i) => ({ ...i, pct: Math.round((i.value / max) * 100) }));
});

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function loadProject() {
  loading.value = true;
  try {
    const data = await cp.getProject(projectId.value);
    project.value = data;
    form.value = {
      name: data.name || '',
      slug: data.slug || '',
      niche: data.niche || '',
      brandVoice: data.brandVoice || '',
      targetAudience: data.targetAudience || '',
      description: data.description || '',
      language: data.language || 'en',
      status: data.status || 'active',
      autoPublishBlog: data.autoPublish?.blog ?? false,
      autoPublishSocial: data.autoPublish?.social ?? false,
    };
  } catch (err: unknown) {
    toast.error('Error loading project', { description: errorMessage(err) });
  } finally {
    loading.value = false;
  }
}

async function loadIdeas() {
  try {
    const res: PaginatedResponse<Idea> | Idea[] = await cp.getIdeas(projectId.value);
    ideas.value = Array.isArray(res) ? res : (res.data ?? []);
  } catch (err: unknown) {
    toast.error('Error loading ideas', { description: errorMessage(err) });
  }
}

async function loadDrafts() {
  try {
    const res: PaginatedResponse<Draft> | Draft[] = await cp.getDrafts(projectId.value);
    drafts.value = Array.isArray(res) ? res : (res.data ?? []);
  } catch (err: unknown) {
    toast.error('Error loading drafts', { description: errorMessage(err) });
  }
}

async function loadMetrics() {
  try {
    metrics.value = await cp.getMetrics(projectId.value);
  } catch (err: unknown) {
    toast.error('Error loading metrics', { description: errorMessage(err) });
  }
}

async function saveProject() {
  errors.value = {};
  const result = schema.safeParse(form.value);
  if (!result.success) {
    const fieldErrors: Partial<Record<keyof FormValues, string>> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof FormValues;
      if (!fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    errors.value = fieldErrors;
    toast.error('Validation error', { description: 'Please fix the highlighted fields' });
    return;
  }

  saving.value = true;
  try {
    const payload: UpdateProjectPayload = {
      name: result.data.name,
      niche: result.data.niche,
      brandVoice: result.data.brandVoice || undefined,
      targetAudience: result.data.targetAudience || undefined,
      description: result.data.description || undefined,
      language: result.data.language,
      status: result.data.status,
      autoPublish: {
        blog: result.data.autoPublishBlog,
        social: result.data.autoPublishSocial,
      },
    };
    const updated = await cp.updateProject(projectId.value, payload);
    project.value = updated;
    toast.success('Project updated');
  } catch (err: unknown) {
    toast.error('Error saving project', { description: errorMessage(err) });
  } finally {
    saving.value = false;
  }
}

async function deleteProject() {
  if (!confirm('Delete this project and all its ideas and drafts?')) return;
  try {
    await cp.deleteProject(projectId.value);
    toast.success('Project deleted');
    navigateTo('/app/content-pipeline/projects');
  } catch (err: unknown) {
    toast.error('Error deleting project', { description: errorMessage(err) });
  }
}

const loadedTabs = ref<Set<string>>(new Set());

onMounted(async () => {
  await loadProject();
  await loadIdeas();
  loadedTabs.value.add('ideas');
});

watch(activeTab, async (tab) => {
  if (loadedTabs.value.has(tab)) return;
  loadedTabs.value.add(tab);
  if (tab === 'drafts') await loadDrafts();
  else if (tab === 'metrics') await loadMetrics();
  else if (tab === 'settings') {
    // settings uses the form already populated in loadProject
  }
});

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
</script>

<template>
  <div class="p-6 space-y-4">
    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <template v-else>
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <NuxtLink to="/app/content-pipeline/projects" class="btn btn-ghost btn-sm">
            ← Back
          </NuxtLink>
          <div>
            <h1 class="text-2xl font-bold">{{ project?.name }}</h1>
            <div class="flex items-center gap-2 mt-1">
              <span v-if="project?.niche" class="badge badge-sm badge-ghost">{{ project.niche }}</span>
              <span v-if="project?.status" class="badge badge-sm badge-outline capitalize">{{ project.status }}</span>
              <span v-if="project?.language" class="badge badge-sm badge-info badge-outline uppercase">{{ project.language }}</span>
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <NuxtLink :to="`/app/content-pipeline/projects/${projectId}/ideas`" class="btn btn-outline btn-sm">
            Ideas board
          </NuxtLink>
          <NuxtLink :to="`/app/content-pipeline/projects/${projectId}/drafts`" class="btn btn-outline btn-sm">
            Drafts list
          </NuxtLink>
        </div>
      </div>

      <!-- Tabs -->
      <div role="tablist" class="tabs tabs-bordered">
        <button
          role="tab"
          class="tab"
          :class="{ 'tab-active': activeTab === 'ideas' }"
          @click="activeTab = 'ideas'"
        >Ideas</button>
        <button
          role="tab"
          class="tab"
          :class="{ 'tab-active': activeTab === 'drafts' }"
          @click="activeTab = 'drafts'"
        >Drafts</button>
        <button
          role="tab"
          class="tab"
          :class="{ 'tab-active': activeTab === 'metrics' }"
          @click="activeTab = 'metrics'"
        >Metrics</button>
        <button
          role="tab"
          class="tab"
          :class="{ 'tab-active': activeTab === 'settings' }"
          @click="activeTab = 'settings'"
        >Settings</button>
      </div>

      <!-- Tab: Ideas (summary) -->
      <div v-if="activeTab === 'ideas'" class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <h2 class="card-title">Ideas ({{ ideas.length }})</h2>
            <NuxtLink :to="`/app/content-pipeline/projects/${projectId}/ideas`" class="btn btn-primary btn-sm">
              Open Kanban board
            </NuxtLink>
          </div>
          <div v-if="ideas.length === 0" class="text-sm text-base-content/40 py-4">
            No ideas yet — open the Kanban board to create one.
          </div>
          <div v-else class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="idea in ideas.slice(0, 10)" :key="idea.id">
                  <td class="font-medium">{{ idea.title }}</td>
                  <td>
                    <span class="badge badge-xs badge-outline capitalize">{{ idea.status }}</span>
                  </td>
                  <td>{{ formatDate(idea.createdAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Tab: Drafts (summary) -->
      <div v-if="activeTab === 'drafts'" class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <h2 class="card-title">Drafts ({{ drafts.length }})</h2>
            <NuxtLink :to="`/app/content-pipeline/projects/${projectId}/drafts`" class="btn btn-primary btn-sm">
              View all drafts
            </NuxtLink>
          </div>
          <div v-if="drafts.length === 0" class="text-sm text-base-content/40 py-4">
            No drafts yet.
          </div>
          <div v-else class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Published</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="draft in drafts.slice(0, 10)"
                  :key="draft.id"
                  class="hover cursor-pointer"
                  @click="navigateTo(`/app/content-pipeline/drafts/${draft.id}`)"
                >
                  <td class="font-medium">{{ draft.idea?.title || draft.title || 'Untitled' }}</td>
                  <td>
                    <span class="badge badge-xs badge-outline capitalize">{{ draft.status }}</span>
                  </td>
                  <td>{{ formatDate(draft.createdAt) }}</td>
                  <td>{{ draft.publishedAt ? formatDate(draft.publishedAt) : '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Tab: Metrics -->
      <div v-if="activeTab === 'metrics'" class="space-y-4">
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h2 class="card-title">Project Metrics</h2>
            <div v-if="!metrics" class="text-sm text-base-content/40 py-4">
              No metrics available.
            </div>
            <div v-else class="space-y-3">
              <div v-for="bar in metricsBars" :key="bar.label" class="flex items-center gap-3">
                <span class="w-28 text-sm truncate">{{ bar.label }}</span>
                <div class="flex-1 bg-base-200 rounded-full h-7 overflow-hidden">
                  <div
                    class="h-full rounded-full flex items-center justify-end pr-2 transition-all"
                    :class="bar.color"
                    :style="{ width: `${bar.pct}%` }"
                  >
                    <span class="text-xs font-semibold text-base-content">{{ bar.value }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="metrics?.ideasByStatus?.length" class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h2 class="card-title">Ideas by Status</h2>
            <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div
                v-for="item in metrics.ideasByStatus"
                :key="item.status"
                class="stat bg-base-200 rounded-box"
              >
                <div class="stat-title capitalize">{{ item.status }}</div>
                <div class="stat-value text-info">{{ item.count }}</div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="metrics?.draftsByStatus?.length" class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h2 class="card-title">Drafts by Status</h2>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div
                v-for="item in metrics.draftsByStatus"
                :key="item.status"
                class="stat bg-base-200 rounded-box"
              >
                <div class="stat-title capitalize">{{ item.status }}</div>
                <div class="stat-value text-warning">{{ item.count }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: Settings -->
      <div v-if="activeTab === 'settings'" class="space-y-4">
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h2 class="card-title">Edit project</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                v-model="form.name"
                label="Name"
                required
                :error="errors.name"
              />
              <FormInput
                v-model="form.slug"
                label="Slug"
                required
                :error="errors.slug"
              />
              <FormInput
                v-model="form.niche"
                label="Niche"
                required
                :error="errors.niche"
              />
              <FormSelect
                v-model="form.language"
                label="Language"
                :options="languageOptions"
              />
              <FormSelect
                v-model="form.status"
                label="Status"
                :options="statusOptions"
              />
              <div class="md:col-span-2">
                <FormTextArea
                  v-model="form.brandVoice"
                  label="Brand Voice"
                  :rows="3"
                />
              </div>
              <div class="md:col-span-2">
                <FormTextArea
                  v-model="form.targetAudience"
                  label="Target Audience"
                  :rows="3"
                />
              </div>
              <div class="md:col-span-2">
                <FormTextArea
                  v-model="form.description"
                  label="Description"
                  :rows="4"
                />
              </div>
            </div>

            <div class="divider">Auto-publish settings</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormSwitch
                v-model="form.autoPublishBlog"
                label="Auto-publish blog posts"
                description="Automatically publish approved blog drafts"
              />
              <FormSwitch
                v-model="form.autoPublishSocial"
                label="Auto-publish social variants"
                description="Automatically publish social media variants"
              />
            </div>

            <div class="card-actions justify-end mt-4">
              <button class="btn btn-error btn-outline" @click="deleteProject">
                Delete project
              </button>
              <button class="btn btn-primary" :disabled="saving" @click="saveProject">
                <span v-if="saving" class="loading loading-spinner loading-xs"></span>
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>