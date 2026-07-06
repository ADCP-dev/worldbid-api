<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { toast } from 'vue-sonner';
import { Video, Loader2, Sparkles, LayoutGrid } from 'lucide-vue-next';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import type {
  GenerateTemplatePayload,
  SlotFill,
  TemplateSlot,
  VideoTemplate,
} from '@/extensions/content-pipeline/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const cp = useContentPipeline();

const loading = ref(false);
const generating = ref(false);
const templates = ref<VideoTemplate[]>([]);
const selectedTemplate = ref<VideoTemplate | null>(null);
const slotFills = ref<Record<number, SlotFill>>({});
const format = ref<'portrait' | 'vertical'>('portrait');
const modalRef = ref<HTMLElement | null>(null);

const formatOptions = [
  { label: 'Portrait', value: 'portrait' },
  { label: 'Vertical', value: 'vertical' },
];

const isModalOpen = computed(() => selectedTemplate.value !== null);

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function loadTemplates() {
  loading.value = true;
  try {
    templates.value = await cp.listTemplates();
  } catch (err: unknown) {
    toast.error('Error loading templates', { description: errorMessage(err) });
  } finally {
    loading.value = false;
  }
}

onMounted(loadTemplates);

function openTemplate(tpl: VideoTemplate) {
  selectedTemplate.value = tpl;
  format.value = tpl.format;
  slotFills.value = {};
  for (const slot of tpl.slots) {
    slotFills.value[slot.position] = {};
  }
  (document.getElementById('cp-template-modal') as HTMLDialogElement | null)?.showModal();
}

function closeTemplate() {
  selectedTemplate.value = null;
  (document.getElementById('cp-template-modal') as HTMLDialogElement | null)?.close();
}

function getSlotImageUrl(slot: TemplateSlot): string {
  return slotFills.value[slot.position]?.imageUrl ?? '';
}

function setSlotImageUrl(slot: TemplateSlot, value: string) {
  if (!slotFills.value[slot.position]) slotFills.value[slot.position] = {};
  slotFills.value[slot.position]!.imageUrl = value;
}

function getSlotSlideText(slot: TemplateSlot): string {
  const slide = slotFills.value[slot.position]?.slide as Record<string, unknown> | undefined;
  if (slide && typeof slide.text === 'string') return slide.text;
  return '';
}

function setSlotSlideText(slot: TemplateSlot, value: string) {
  if (!slotFills.value[slot.position]) slotFills.value[slot.position] = {};
  slotFills.value[slot.position]!.slide = { text: value };
}

async function handleGenerate() {
  if (!selectedTemplate.value) return;
  // Normalize slotFills: drop empties.
  const slots: Record<number, SlotFill> = {};
  for (const [key, fill] of Object.entries(slotFills.value)) {
    const pos = Number(key);
    const hasImage = typeof fill.imageUrl === 'string' && fill.imageUrl.trim() !== '';
    const hasSlide = fill.slide && Object.keys(fill.slide).length > 0;
    if (hasImage || hasSlide) {
      slots[pos] = {
        imageUrl: hasImage ? fill.imageUrl : undefined,
        slide: hasSlide ? fill.slide : undefined,
      };
    }
  }
  const payload: GenerateTemplatePayload = {
    template: selectedTemplate.value.type,
    format: format.value,
    slots,
  };
  generating.value = true;
  try {
    const result = await cp.generateFromTemplate(payload);
    toast.success('Job queued', { description: result.jobId });
    closeTemplate();
    navigateTo('/app/content-pipeline/video-jobs');
  } catch (err: unknown) {
    toast.error('Error generating video', { description: errorMessage(err) });
  } finally {
    generating.value = false;
  }
}
</script>

<template>
  <div class="p-6 space-y-4">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <LayoutGrid class="w-6 h-6 text-primary" />
      <h1 class="text-2xl font-bold">Video Templates</h1>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <!-- Empty -->
    <div
      v-else-if="templates.length === 0"
      class="card bg-base-100 shadow-sm border border-base-300"
    >
      <div class="card-body items-center text-center py-12">
        <Video class="w-10 h-10 text-base-content/30" />
        <p class="text-base-content/50">No templates available.</p>
      </div>
    </div>

    <!-- Grid of template cards -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="tpl in templates"
        :key="tpl.type"
        class="card bg-base-100 shadow-sm border border-base-300 hover:border-primary/50 transition-colors"
      >
        <div class="card-body">
          <div class="flex items-center justify-between">
            <h2 class="card-title">{{ tpl.name }}</h2>
            <span class="badge badge-sm badge-outline capitalize">{{ tpl.format }}</span>
          </div>
          <p class="text-sm text-base-content/70 line-clamp-3">{{ tpl.description }}</p>
          <div class="flex flex-wrap gap-2 mt-2">
            <span class="badge badge-sm badge-ghost">Slots: {{ tpl.slots.length }}</span>
            <span class="badge badge-sm" :class="tpl.appendCtaVideo ? 'badge-success' : 'badge-ghost'">
              CTA: {{ tpl.appendCtaVideo ? 'yes' : 'no' }}
            </span>
            <span class="badge badge-sm badge-ghost">{{ tpl.defaultSlideDurationSec }}s/slide</span>
          </div>
          <div class="card-actions justify-end mt-2">
            <button class="btn btn-primary btn-sm" @click="openTemplate(tpl)">
              <Sparkles class="w-4 h-4" />
              Use template
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal: slot fills -->
    <dialog id="cp-template-modal" ref="modalRef" class="modal modal-bottom sm:modal-middle">
      <div class="modal-box max-w-2xl">
        <div v-if="selectedTemplate">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-bold">{{ selectedTemplate.name }}</h3>
            <button class="btn btn-ghost btn-xs" @click="closeTemplate">✕</button>
          </div>
          <p class="text-sm text-base-content/60 mb-3">{{ selectedTemplate.description }}</p>

          <div class="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div
              v-for="slot in selectedTemplate.slots"
              :key="slot.position"
              class="border border-base-300 rounded-lg p-3 space-y-2"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="badge badge-sm badge-outline">#{{ slot.position + 1 }}</span>
                  <span class="font-semibold text-sm">{{ slot.label }}</span>
                  <span class="badge badge-xs badge-ghost capitalize">{{ slot.slotType }}</span>
                </div>
                <span v-if="slot.required" class="badge badge-xs badge-warning">required</span>
              </div>
              <FormInput
                v-if="slot.acceptImage"
                :model-value="getSlotImageUrl(slot)"
                label="Image URL"
                placeholder="https://..."
                @update:model-value="(v: string | number) => setSlotImageUrl(slot, String(v))"
              />
              <FormTextArea
                :model-value="getSlotSlideText(slot)"
                label="Slide text"
                :rows="3"
                placeholder="Slide content text..."
                @update:model-value="(v: string) => setSlotSlideText(slot, v)"
              />
            </div>

            <FormSelect
              v-model="format"
              label="Format"
              :options="formatOptions"
            />
          </div>

          <div class="modal-action">
            <button class="btn btn-ghost" @click="closeTemplate">Cancel</button>
            <button class="btn btn-primary" :disabled="generating" @click="handleGenerate">
              <Loader2 v-if="generating" class="w-4 h-4 animate-spin" />
              <Video v-else class="w-4 h-4" />
              Generate Video
            </button>
          </div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop"><button>close</button></form>
    </dialog>
  </div>
</template>