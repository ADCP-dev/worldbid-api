<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { toast } from 'vue-sonner';
import { z } from 'zod';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';
import type { CreateProjectPayload, Project } from '@/extensions/content-pipeline/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const cp = useContentPipeline();

const saving = ref(false);

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

// Auto-generate slug from name
watch(
  () => form.value.name,
  (name) => {
    if (name && !form.value.slug) {
      form.value.slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }
  },
);

const languageOptions = [
  { label: 'English', value: 'en' },
  { label: 'Español', value: 'es' },
];

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Paused', value: 'paused' },
  { label: 'Archived', value: 'archived' },
];

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
    const payload: CreateProjectPayload = {
      name: result.data.name,
      slug: result.data.slug,
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
    const project: Project = await cp.createProject(payload);
    toast.success('Project created');
    navigateTo(`/app/content-pipeline/projects/${project.id}`);
  } catch (err: unknown) {
    if (err instanceof Error) toast.error('Error creating project', { description: err.message });
    else toast.error('Error creating project');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center gap-3">
      <NuxtLink to="/app/content-pipeline/projects" class="btn btn-ghost btn-sm">← Back</NuxtLink>
      <h1 class="text-2xl font-bold">New Project</h1>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            v-model="form.name"
            label="Name"
            required
            placeholder="My content project"
            :error="errors.name"
          />
          <FormInput
            v-model="form.slug"
            label="Slug"
            required
            placeholder="my-content-project"
            :error="errors.slug"
          />
          <FormInput
            v-model="form.niche"
            label="Niche"
            required
            placeholder="Technology, Marketing..."
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
              placeholder="Professional, friendly, authoritative..."
            />
          </div>
          <div class="md:col-span-2">
            <FormTextArea
              v-model="form.targetAudience"
              label="Target Audience"
              :rows="3"
              placeholder="Describe your target audience..."
            />
          </div>
          <div class="md:col-span-2">
            <FormTextArea
              v-model="form.description"
              label="Description"
              :rows="4"
              placeholder="Project description..."
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
          <NuxtLink to="/app/content-pipeline/projects" class="btn btn-ghost">Cancel</NuxtLink>
          <button class="btn btn-primary" :disabled="saving" @click="submit">
            <span v-if="saving" class="loading loading-spinner loading-xs"></span>
            Create project
          </button>
        </div>
      </div>
    </div>
  </div>
</template>