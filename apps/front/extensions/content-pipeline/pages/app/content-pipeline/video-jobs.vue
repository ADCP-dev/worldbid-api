<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { toast } from 'vue-sonner';
import { Video, Loader2, CheckCircle, XCircle, Plus } from 'lucide-vue-next';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import type { VideoJobStatus } from '@/extensions/content-pipeline/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const cp = useContentPipeline();

interface TrackedJob {
  jobId: string;
  status: VideoJobStatus | null;
  loading: boolean;
  error: string | null;
}

const trackedJobs = ref<TrackedJob[]>([]);
const newJobId = ref('');
const pollingInterval = ref<ReturnType<typeof setInterval> | null>(null);

const pendingJobs = computed(() =>
  trackedJobs.value.filter((j) => {
    const state = j.status?.state;
    return state && state !== 'completed' && state !== 'failed';
  }),
);

const stateBadgeClass: Record<string, string> = {
  waiting: 'badge-warning',
  delayed: 'badge-warning',
  active: 'badge-info',
  completed: 'badge-success',
  failed: 'badge-error',
};

function truncateId(id: string, len = 12): string {
  if (id.length <= len) return id;
  return `${id.slice(0, len)}…`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function addJob() {
  const id = newJobId.value.trim();
  if (!id) {
    toast.error('Enter a job ID to track');
    return;
  }
  if (trackedJobs.value.some((j) => j.jobId === id)) {
    toast.error('Job already tracked');
    return;
  }
  trackedJobs.value.unshift({ jobId: id, status: null, loading: true, error: null });
  newJobId.value = '';
  void pollJob(id);
}

function removeJob(jobId: string) {
  trackedJobs.value = trackedJobs.value.filter((j) => j.jobId !== jobId);
}

async function pollJob(jobId: string) {
  const job = trackedJobs.value.find((j) => j.jobId === jobId);
  if (!job) return;
  job.loading = true;
  job.error = null;
  try {
    const status = await cp.getVideoJobStatus(jobId);
    const prev = job.status;
    job.status = status;
    if (prev?.state !== 'completed' && status.state === 'completed') {
      toast.success('Video job completed', { description: truncateId(jobId) });
    } else if (prev?.state !== 'failed' && status.state === 'failed') {
      toast.error('Video job failed', { description: status.failedReason || truncateId(jobId) });
    }
  } catch (err: unknown) {
    job.error = err instanceof Error ? err.message : String(err);
  } finally {
    job.loading = false;
  }
}

function pollAll() {
  for (const job of pendingJobs.value) {
    void pollJob(job.jobId);
  }
}

onMounted(() => {
  pollingInterval.value = setInterval(pollAll, 3000);
});

onUnmounted(() => {
  if (pollingInterval.value) {
    clearInterval(pollingInterval.value);
    pollingInterval.value = null;
  }
});
</script>

<template>
  <div class="p-6 space-y-4">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <Video class="w-6 h-6 text-primary" />
      <h1 class="text-2xl font-bold">Video Jobs</h1>
    </div>

    <!-- Add job input -->
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body">
        <h2 class="card-title">Track a job</h2>
        <p class="text-sm text-base-content/60">
          Enter a video job ID returned by a generate-video / template-generate action to follow its progress.
        </p>
        <div class="flex gap-2 items-end mt-2">
          <div class="flex-1">
            <FormInput
              v-model="newJobId"
              label="Job ID"
              placeholder="e.g. 7f9b3c2a-..."
              testId="video-job-id-input"
            />
          </div>
          <button class="btn btn-primary" @click="addJob">
            <Plus class="w-4 h-4" />
            Track
          </button>
        </div>
      </div>
    </div>

    <!-- Job list -->
    <div v-if="trackedJobs.length === 0" class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body items-center text-center py-12">
        <Video class="w-10 h-10 text-base-content/30" />
        <p class="text-base-content/50">No video jobs tracked yet.</p>
        <p class="text-xs text-base-content/40">
          Trigger generation from a draft or template, then paste the jobId here.
        </p>
      </div>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="job in trackedJobs"
        :key="job.jobId"
        class="card bg-base-100 shadow-sm border border-base-300"
      >
        <div class="card-body">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="font-mono text-sm truncate">{{ truncateId(job.jobId, 20) }}</span>
              <span
                v-if="job.status?.state"
                class="badge badge-sm capitalize"
                :class="stateBadgeClass[job.status.state] ?? 'badge-outline'"
              >
                {{ job.status.state }}
              </span>
              <span v-else-if="job.loading" class="badge badge-sm badge-ghost">
                <Loader2 class="w-3 h-3 animate-spin" />
                fetching
              </span>
            </div>
            <button class="btn btn-ghost btn-xs" @click="removeJob(job.jobId)">Remove</button>
          </div>

          <!-- Error -->
          <div v-if="job.error" class="alert alert-error py-2 mt-2">
            <XCircle class="w-4 h-4" />
            <span class="text-sm">{{ job.error }}</span>
          </div>

          <!-- Completed result -->
          <div v-if="job.status?.state === 'completed' && job.status.result" class="mt-2 space-y-1">
            <div class="flex items-center gap-2 text-sm">
              <CheckCircle class="w-4 h-4 text-success" />
              <span class="text-base-content/60">Video:</span>
              <span class="font-mono text-xs break-all">{{ job.status.result.videoPath }}</span>
            </div>
            <div class="flex gap-4 text-xs text-base-content/60">
              <span>Duration: {{ job.status.result.durationSec }}s</span>
              <span>Size: {{ formatBytes(job.status.result.sizeBytes) }}</span>
              <span v-if="job.status.result.ctaVideoUrl">CTA: attached</span>
              <span v-if="job.status.result.templateType">Template: {{ job.status.result.templateType }}</span>
            </div>
            <div v-if="job.status.result.postText" class="text-xs text-base-content/60 mt-1">
              <span class="font-semibold">Post text:</span> {{ job.status.result.postText }}
            </div>
          </div>

          <!-- Failed reason -->
          <div v-if="job.status?.state === 'failed'" class="alert alert-error py-2 mt-2">
            <XCircle class="w-4 h-4" />
            <span class="text-sm">{{ job.status.failedReason || 'Job failed without reason' }}</span>
          </div>

          <!-- Carousel HTML preview -->
          <details
            v-if="job.status?.state === 'completed' && job.status.result?.carouselHtml?.length"
            class="mt-2"
          >
            <summary class="cursor-pointer text-sm text-base-content/70">
              Carousel slides ({{ job.status.result.carouselHtml.length }})
            </summary>
            <div class="mt-2 space-y-2">
              <div
                v-for="(html, idx) in job.status.result.carouselHtml"
                :key="idx"
                class="bg-base-200 rounded p-2 text-xs"
              >
                <div class="font-semibold mb-1">Slide {{ idx + 1 }}</div>
                <div class="whitespace-pre-wrap break-words max-h-40 overflow-auto" v-html="html" />
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  </div>
</template>