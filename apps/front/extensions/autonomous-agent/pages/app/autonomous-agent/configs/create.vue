<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { toast } from 'vue-sonner';
import { z } from 'zod';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';
import type { AutonomousConfigPayload, ConfigEntity, ProjectEntity } from '@/extensions/autonomous-agent/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const aa = useAutonomousAgent();
const cp = useContentPipeline();

const saving = ref(false);
const loadingProjects = ref(true);
const projects = ref<ProjectEntity[]>([]);

const projectOptions = computed(() =>
  projects.value.map((p) => ({ label: p.name, value: String(p.id) })),
);

const cronRegex = /^(\*|(\d+|\*\/\d+|\d+-\d+|\d+(,\d+)*)(\/\d+)?)(\s+(\d+|\*\/\d+|\d+-\d+|\d+(,\d+)*)(\/\d+)?){4}$/;
const cronOptional = z
  .string()
  .optional()
  .refine(
    (val) => !val || cronRegex.test(val),
    'Invalid cron expression (5 fields: min hour dom month dow)',
  );

const schema = z.object({
  projectId: z.string().min(1, 'Project is required'),
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
  projectId: '',
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

async function loadProjects() {
  loadingProjects.value = true;
  try {
    const res = await cp.getProjects(1, 200);
    projects.value = 'data' in res ? (res.data ?? []) : (res ?? []);
  } catch (err: unknown) {
    if (err instanceof Error) toast.error('Error loading projects', { description: err.message });
    else toast.error('Error loading projects');
  } finally {
    loadingProjects.value = false;
  }
}

onMounted(loadProjects);

async function submit() {
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
    const payload: AutonomousConfigPayload = {
      projectId: Number(result.data.projectId),
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
    const config: ConfigEntity = await aa.createConfig(payload);
    toast.success('Config created');
    navigateTo(`/app/autonomous-agent/configs/${config.id}`);
  } catch (err: unknown) {
    if (err instanceof Error) toast.error('Error creating config', { description: err.message });
    else toast.error('Error creating config');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center gap-3">
      <NuxtLink to="/app/autonomous-agent/configs" class="btn btn-ghost btn-sm">← Back</NuxtLink>
      <h1 class="text-2xl font-bold">New Autonomous Agent Config</h1>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body">
        <div v-if="loadingProjects" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md text-primary" />
        </div>

        <template v-else>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="md:col-span-2">
              <FormSelect
                v-model="form.projectId"
                label="Project"
                required
                placeholder="Select a content-pipeline project"
                :options="projectOptions"
                :error="errors.projectId"
              />
            </div>
          </div>

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
            <NuxtLink to="/app/autonomous-agent/configs" class="btn btn-ghost">Cancel</NuxtLink>
            <button class="btn btn-primary" :disabled="saving" @click="submit">
              <span v-if="saving" class="loading loading-spinner loading-xs"/>
              Create config
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>