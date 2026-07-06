<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { toast } from 'vue-sonner';
import { z } from 'zod';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const route = useRoute();
const aa = useAutonomousAgent();
const cp = useContentPipeline();

const configId = computed(() => route.params.id as string);

const loading = ref(false);
const saving = ref(false);
const toggling = ref(false);
const config = ref<any>(null);
const project = ref<any>(null);

const cronRegex = /^(\*|(\d+|\*\/\d+|\d+-\d+|\d+(,\d+)*)(\/\d+)?)(\s+(\d+|\*\/\d+|\d+-\d+|\d+(,\d+)*)(\/\d+)?){4}$/;
const cronOptional = z
  .string()
  .optional()
  .refine(
    (val) => !val || cronRegex.test(val),
    'Invalid cron expression (5 fields: min hour dom month dow)',
  );

const schema = z.object({
  researchCron: cronOptional,
  generateCron: cronOptional,
  publishCron: cronOptional,
  metricsCron: cronOptional,
  autoApproveIdeas: z.boolean().default(false),
  autoApproveDrafts: z.boolean().default(false),
  notifyEmail: z.boolean().default(false),
  notifyTelegram: z.boolean().default(false),
  telegramChatId: z.string().optional().default(''),
});

type FormValues = z.infer<typeof schema>;

const form = ref<FormValues>({
  researchCron: '',
  generateCron: '',
  publishCron: '',
  metricsCron: '',
  autoApproveIdeas: false,
  autoApproveDrafts: false,
  notifyEmail: false,
  notifyTelegram: false,
  telegramChatId: '',
});

const errors = ref<Partial<Record<keyof FormValues, string>>>({});

const isPaused = computed(() => config.value?.status === 'paused');

async function loadConfig() {
  loading.value = true;
  try {
    const data = await aa.getConfig(configId.value);
    config.value = data;
    form.value = {
      researchCron: data.researchCron || '',
      generateCron: data.generateCron || '',
      publishCron: data.publishCron || '',
      metricsCron: data.metricsCron || '',
      autoApproveIdeas: data.autoApproveIdeas ?? false,
      autoApproveDrafts: data.autoApproveDrafts ?? false,
      notifyEmail: data.notifyEmail ?? false,
      notifyTelegram: data.notifyTelegram ?? false,
      telegramChatId: data.telegramChatId || '',
    };
    // Load project name for display
    if (data.projectId) {
      try {
        project.value = await cp.getProject(data.projectId);
      } catch {
        project.value = { id: data.projectId, name: `#${data.projectId}` };
      }
    }
  } catch (err: any) {
    toast.error('Error loading config', { description: err.message });
  } finally {
    loading.value = false;
  }
}

async function saveConfig() {
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
    const payload: Record<string, any> = {
      researchCron: result.data.researchCron || undefined,
      generateCron: result.data.generateCron || undefined,
      publishCron: result.data.publishCron || undefined,
      metricsCron: result.data.metricsCron || undefined,
      autoApproveIdeas: result.data.autoApproveIdeas,
      autoApproveDrafts: result.data.autoApproveDrafts,
      notifyEmail: result.data.notifyEmail,
      notifyTelegram: result.data.notifyTelegram,
      telegramChatId: result.data.telegramChatId || undefined,
    };
    const updated = await aa.updateConfig(configId.value, payload);
    config.value = updated;
    toast.success('Config updated');
  } catch (err: any) {
    toast.error('Error saving config', { description: err.message });
  } finally {
    saving.value = false;
  }
}

async function togglePause() {
  toggling.value = true;
  try {
    if (isPaused.value) {
      config.value = await aa.resumeConfig(configId.value);
      toast.success('Config resumed');
    } else {
      config.value = await aa.pauseConfig(configId.value);
      toast.success('Config paused');
    }
  } catch (err: any) {
    toast.error('Error toggling config state', { description: err.message });
  } finally {
    toggling.value = false;
  }
}

async function deleteConfig() {
  if (!confirm('Delete this config? The autonomous agent will stop running.')) return;
  try {
    await aa.deleteConfig(configId.value);
    toast.success('Config deleted');
    navigateTo('/app/autonomous-agent/configs');
  } catch (err: any) {
    toast.error('Error deleting config', { description: err.message });
  }
}

function formatDate(date: string) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

onMounted(loadConfig);
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
          <NuxtLink to="/app/autonomous-agent/configs" class="btn btn-ghost btn-sm">
            ← Back
          </NuxtLink>
          <div>
            <h1 class="text-2xl font-bold">
              {{ project?.name || `Config #${configId}` }}
            </h1>
            <div class="flex items-center gap-2 mt-1">
              <span
                class="badge badge-sm capitalize"
                :class="isPaused ? 'badge-warning' : 'badge-success'"
              >
                {{ config?.status || '—' }}
              </span>
              <span v-if="config?.lastRunAt" class="text-xs text-base-content/50">
                Last run: {{ formatDate(config.lastRunAt) }}
              </span>
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <button
            class="btn btn-sm"
            :class="isPaused ? 'btn-success' : 'btn-warning'"
            :disabled="toggling"
            @click="togglePause"
          >
            <span v-if="toggling" class="loading loading-spinner loading-xs"></span>
            {{ isPaused ? 'Resume' : 'Pause' }}
          </button>
          <button class="btn btn-error btn-sm btn-outline" @click="deleteConfig">
            Delete
          </button>
        </div>
      </div>

      <!-- Edit form -->
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h2 class="card-title">Edit Config</h2>

          <div class="divider">Cron Schedules</div>
          <p class="text-sm text-base-content/60 -mt-2 mb-2">
            Standard 5-field cron: <code class="bg-base-200 px-1 rounded">min hour dom month dow</code>
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              v-model="form.researchCron"
              label="Research Cron"
              placeholder="0 9 * * *"
              :error="errors.researchCron"
              description="When to run idea research"
            />
            <FormInput
              v-model="form.generateCron"
              label="Generate Cron"
              placeholder="0 10 * * *"
              :error="errors.generateCron"
              description="When to generate drafts from ideas"
            />
            <FormInput
              v-model="form.publishCron"
              label="Publish Cron"
              placeholder="0 12 * * *"
              :error="errors.publishCron"
              description="When to publish approved drafts"
            />
            <FormInput
              v-model="form.metricsCron"
              label="Metrics Cron"
              placeholder="0 0 * * 0"
              :error="errors.metricsCron"
              description="When to collect metrics"
            />
          </div>

          <div class="divider">Auto-approve</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormSwitch
              v-model="form.autoApproveIdeas"
              label="Auto-approve ideas"
              description="Automatically approve researched ideas"
            />
            <FormSwitch
              v-model="form.autoApproveDrafts"
              label="Auto-approve drafts"
              description="Automatically approve generated drafts"
            />
          </div>

          <div class="divider">Notifications</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormSwitch
              v-model="form.notifyEmail"
              label="Notify via email"
              description="Send run notifications to email"
            />
            <FormSwitch
              v-model="form.notifyTelegram"
              label="Notify via Telegram"
              description="Send run notifications to Telegram"
            />
            <FormInput
              v-model="form.telegramChatId"
              label="Telegram Chat ID"
              placeholder="-1001234567890"
              :error="errors.telegramChatId"
              description="Required if Telegram notifications are enabled"
            />
          </div>

          <div class="card-actions justify-end mt-4">
            <button class="btn btn-primary" :disabled="saving" @click="saveConfig">
              <span v-if="saving" class="loading loading-spinner loading-xs"></span>
              Save
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>