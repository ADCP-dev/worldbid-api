<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { z } from 'zod';
import { toast } from 'vue-sonner';
import { Check, X, Send, ArrowLeft } from 'lucide-vue-next';
import RichEditor from '@base/ui-app/components/rich-editor/RichEditor.vue';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue';
import type { Draft } from '@/extensions/content-pipeline/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const route = useRoute();
const cp = useContentPipeline();

const draftId = computed(() => route.params.id as string);

const loading = ref(false);
const saving = ref(false);
const acting = ref(false);
const draft = ref<Draft | null>(null);
const blogContent = ref('');
const seoTitle = ref('');
const seoDescription = ref('');
const seoKeywords = ref('');

// ─── SEO validation ───────────────────────────────────────────────────────

const seoSchema = z.object({
  seoTitle: z.string().max(60, 'SEO title must be 60 characters or less'),
  seoDescription: z.string().max(160, 'Meta description must be 160 characters or less'),
  seoKeywords: z.string().optional(),
});

const seoErrors = ref<Record<string, string>>({});

const isPending = computed(() => draft.value?.status === 'pending');
const isApproved = computed(() => draft.value?.status === 'approved');
const isRejected = computed(() => draft.value?.status === 'rejected');
const isPublished = computed(() => draft.value?.status === 'published');

const socialVariants = computed(() => draft.value?.socialVariants ?? []);
const images = computed(() => draft.value?.images ?? []);
const ideaTitle = computed(() => draft.value?.idea?.title || draft.value?.title || 'Untitled draft');

async function loadDraft() {
  loading.value = true;
  try {
    const data = await cp.getDraft(draftId.value);
    draft.value = data;
    blogContent.value = data.blogContent || '';
    seoTitle.value = data.seoMetadata?.title || '';
    seoDescription.value = data.seoMetadata?.description || '';
    seoKeywords.value = Array.isArray(data.seoMetadata?.keywords)
      ? data.seoMetadata.keywords.join(', ')
      : data.seoMetadata?.keywords || '';
  } catch (err: unknown) {
    if (err instanceof Error) toast.error('Error loading draft', { description: err.message });
    else toast.error('Error loading draft');
  } finally {
    loading.value = false;
  }
}

onMounted(loadDraft);

async function saveContent() {
  seoErrors.value = {};
  const result = seoSchema.safeParse({
    seoTitle: seoTitle.value,
    seoDescription: seoDescription.value,
    seoKeywords: seoKeywords.value,
  });
  if (!result.success) {
    result.error.issues.forEach((issue) => {
      seoErrors.value[issue.path[0] as string] = issue.message;
    });
    toast.error('Please fix the SEO errors');
    return;
  }
  saving.value = true;
  try {
    const keywords = seoKeywords.value
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    await cp.updateDraft(draftId.value, {
      blogContent: blogContent.value,
      seoMetadata: {
        title: seoTitle.value || undefined,
        description: seoDescription.value || undefined,
        keywords: keywords.length ? keywords : undefined,
      },
    });
    toast.success('Draft saved');
  } catch (err: unknown) {
    if (err instanceof Error) toast.error('Error saving draft', { description: err.message });
    else toast.error('Error saving draft');
  } finally {
    saving.value = false;
  }
}

async function handleApprove() {
  acting.value = true;
  try {
    await cp.approveDraft(draftId.value);
    toast.success('Draft approved');
    await loadDraft();
  } catch (err: unknown) {
    if (err instanceof Error) toast.error('Error approving draft', { description: err.message });
    else toast.error('Error approving draft');
  } finally {
    acting.value = false;
  }
}

async function handleReject() {
  const reason = prompt('Rejection reason (optional):') || '';
  acting.value = true;
  try {
    await cp.rejectDraft(draftId.value, { reason });
    toast.success('Draft rejected');
    await loadDraft();
  } catch (err: unknown) {
    if (err instanceof Error) toast.error('Error rejecting draft', { description: err.message });
    else toast.error('Error rejecting draft');
  } finally {
    acting.value = false;
  }
}

async function handlePublish() {
  if (!confirm('Publish this draft? This action may be irreversible.')) return;
  acting.value = true;
  try {
    await cp.publishDraft(draftId.value);
    toast.success('Draft published');
    await loadDraft();
  } catch (err: unknown) {
    if (err instanceof Error) toast.error('Error publishing draft', { description: err.message });
    else toast.error('Error publishing draft');
  } finally {
    acting.value = false;
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const statusBadgeClass: Record<string, string> = {
  pending: 'badge-warning',
  approved: 'badge-success',
  rejected: 'badge-error',
  published: 'badge-primary',
};
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
          <NuxtLink
            :to="draft?.projectId ? `/app/content-pipeline/projects/${draft.projectId}/drafts` : '/app/content-pipeline/projects'"
            class="btn btn-ghost btn-sm"
          >
            <ArrowLeft class="w-4 h-4" />
            Back
          </NuxtLink>
          <div>
            <h1 class="text-2xl font-bold">{{ ideaTitle }}</h1>
            <div class="flex items-center gap-2 mt-1">
              <span
                class="badge badge-sm capitalize"
                :class="statusBadgeClass[draft?.status] ?? 'badge-outline'"
              >
                {{ draft?.status }}
              </span>
              <span v-if="draft?.createdAt" class="text-xs text-base-content/60">
                Created {{ formatDate(draft.createdAt) }}
              </span>
              <span v-if="draft?.publishedAt" class="text-xs text-base-content/60">
                · Published {{ formatDate(draft.publishedAt) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="flex items-center gap-2">
          <button
            v-if="isPending"
            class="btn btn-success btn-sm"
            :disabled="acting"
            @click="handleApprove"
          >
            <Check class="w-4 h-4" />
            Approve
          </button>
          <button
            v-if="isPending"
            class="btn btn-error btn-outline btn-sm"
            :disabled="acting"
            @click="handleReject"
          >
            <X class="w-4 h-4" />
            Reject
          </button>
          <button
            v-if="isApproved"
            class="btn btn-primary btn-sm"
            :disabled="acting"
            @click="handlePublish"
          >
            <Send class="w-4 h-4" />
            Publish
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Main content: RichEditor -->
        <div class="lg:col-span-2 space-y-4">
          <div class="card bg-base-100 shadow-sm border border-base-300">
            <div class="card-body">
              <div class="flex items-center justify-between">
                <h2 class="card-title">Blog Content</h2>
                <button
                  class="btn btn-ghost btn-sm"
                  :disabled="saving"
                  @click="saveContent"
                >
                  <span v-if="saving" class="loading loading-spinner loading-xs"></span>
                  Save
                </button>
              </div>
              <RichEditor v-model="blogContent" />
            </div>
          </div>

          <!-- SEO Metadata -->
          <div class="card bg-base-100 shadow-sm border border-base-300">
            <div class="card-body">
              <h2 class="card-title">SEO Metadata</h2>
              <div class="space-y-3">
                <FormInput
                  v-model="seoTitle"
                  label="SEO Title"
                  placeholder="SEO title..."
                  :error="seoErrors.seoTitle"
                  description="Max 60 characters"
                />
                <FormTextArea
                  v-model="seoDescription"
                  label="Meta Description"
                  placeholder="Meta description..."
                  :rows="3"
                  :maxlength="160"
                  :error="seoErrors.seoDescription"
                />
                <FormInput
                  v-model="seoKeywords"
                  label="Keywords (comma-separated)"
                  placeholder="keyword1, keyword2..."
                  :error="seoErrors.seoKeywords"
                />
              </div>
              <div class="card-actions justify-end mt-2">
                <button class="btn btn-primary btn-sm" :disabled="saving" @click="saveContent">
                  Save SEO
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Sidebar: Social variants, Images -->
        <div class="space-y-4">
          <!-- Social Variants -->
          <div class="card bg-base-100 shadow-sm border border-base-300">
            <div class="card-body">
              <h2 class="card-title">Social Variants</h2>
              <div v-if="socialVariants.length === 0" class="text-sm text-base-content/40 py-2">
                No social variants generated.
              </div>
              <div v-else class="space-y-3">
                <div
                  v-for="variant in socialVariants"
                  :key="variant.platform || variant.id"
                  class="card card-compact bg-base-200"
                >
                  <div class="card-body">
                    <div class="flex items-center justify-between">
                      <span class="badge badge-sm capitalize">{{ variant.platform }}</span>
                    </div>
                    <p class="text-sm whitespace-pre-wrap">{{ variant.content }}</p>
                    <div v-if="variant.hashtags?.length" class="flex flex-wrap gap-1 mt-1">
                      <span
                        v-for="tag in variant.hashtags"
                        :key="tag"
                        class="badge badge-xs badge-outline"
                      >{{ tag }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Images -->
          <div class="card bg-base-100 shadow-sm border border-base-300">
            <div class="card-body">
              <h2 class="card-title">Images</h2>
              <div v-if="images.length === 0" class="text-sm text-base-content/40 py-2">
                No images generated.
              </div>
              <div v-else class="grid grid-cols-2 gap-2">
                <div
                  v-for="(img, idx) in images"
                  :key="idx"
                  class="rounded-lg overflow-hidden border border-base-300"
                >
                  <img
                    :src="typeof img === 'string' ? img : img.url"
                    :alt="typeof img === 'string' ? `Image ${idx + 1}` : img.alt || `Image ${idx + 1}`"
                    class="w-full h-32 object-cover"
                  >
                </div>
              </div>
            </div>
          </div>

          <!-- Rejection reason if rejected -->
          <div v-if="isRejected && draft?.rejectionReason" class="card bg-error/10 border border-error/30">
            <div class="card-body">
              <h2 class="card-title text-error">Rejection Reason</h2>
              <p class="text-sm">{{ draft.rejectionReason }}</p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>