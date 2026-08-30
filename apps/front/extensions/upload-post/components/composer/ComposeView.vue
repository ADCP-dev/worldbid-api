<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import ComposerStepper from './ComposerStepper.vue';
import AspectRatioPicker from './AspectRatioPicker.vue';
import PlatformPicker from './PlatformPicker.vue';
import MediaDropzone from './MediaDropzone.vue';
import ScheduleForm from './ScheduleForm.vue';
import ResultsPanel from './ResultsPanel.vue';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue';
import {
  provideComposer,
  useComposer,
} from '../../composables/useComposer';

const { t } = useI18n();

const composerState = provideComposer();
const composer = useComposer(composerState);
const state = composer.state;

const stepIndex = computed(() => composer.steps.indexOf(state.step));
const isDispatching = ref(false);
const dispatchedRequestId = ref<string | null>(null);
const dispatchedLocalId = ref<string | undefined>(undefined);

function selectStep(i: number) {
  const target = composer.steps[i];
  if (target) composer.goTo(target);
}

function togglePlatform(platform: string) {
  if (state.platforms.includes(platform)) {
    state.platforms = state.platforms.filter((p) => p !== platform);
  } else {
    state.platforms = [...state.platforms, platform];
  }
}

watch(
  () => [state.aspectRatio, state.mediaType] as const,
  () => {
    const allowed = composer.allowedPlatforms.value;
    state.platforms = state.platforms.filter((p) => allowed.includes(p));
  },
);

async function onDispatch() {
  isDispatching.value = true;
  try {
    const res = await composer.dispatch();
    dispatchedRequestId.value = res.requestId;
    dispatchedLocalId.value = res.localId;
    toast.success(t('ext.upload-post.composer.dispatchAccepted'));
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? t(`ext.upload-post.errors.${err.message}`, err.message)
        : t('ext.upload-post.common.requestFailed');
    toast.error(message);
  } finally {
    isDispatching.value = false;
  }
}

function onRestart() {
  dispatchedRequestId.value = null;
  dispatchedLocalId.value = undefined;
  composer.reset();
}
</script>

<template>
  <div class="space-y-6">
    <ResultsPanel
      v-if="dispatchedRequestId || dispatchedLocalId"
      :request-id="dispatchedRequestId"
      :local-id="dispatchedLocalId"
      @reset="onRestart"
    />

    <div v-else class="space-y-8">
      <ComposerStepper
        :current="stepIndex"
        @select="selectStep"
      />

      <!-- Step 1: ratio + mediaType -->
      <AspectRatioPicker
        v-show="state.step === 'format'"
        v-model:ratio="state.aspectRatio"
        v-model:type="state.mediaType"
      />

      <!-- Step 2: media -->
      <div v-if="state.step === 'media'" class="space-y-4">
        <MediaDropzone
          v-if="state.mediaType && state.mediaType !== 'text'"
          v-model:files="state.mediaFiles"
          v-model:urls="state.mediaUrls"
          :media-type="state.mediaType"
        />
        <p v-else class="text-sm text-base-content/60">
          {{ t('ext.upload-post.composer.textNoMedia') }}
        </p>
      </div>

      <!-- Step 3: platforms + destinations -->
      <PlatformPicker
        v-show="state.step === 'platforms'"
        v-model:facebook-page-id="state.facebookPageId"
        v-model:linkedin-page-id="state.linkedinPageId"
        v-model:pinterest-board="state.pinterestBoard"
        :all-platforms="composer.allowedPlatforms.value"
        :selected="state.platforms"
        @toggle="togglePlatform"
      />

      <!-- Step 4: caption -->
      <div v-show="state.step === 'caption'" class="space-y-4">
        <FormInput
          v-model="state.title"
          :label="t('ext.upload-post.composer.titleLabel')"
          :placeholder="t('ext.upload-post.composer.titlePlaceholder')"
        />
        <FormTextArea
          v-model="state.caption"
          :label="t('ext.upload-post.composer.captionLabel')"
          :placeholder="t('ext.upload-post.composer.captionPlaceholder')"
          :rows="6"
        />
        <p class="text-xs text-base-content/50">
          {{ t('ext.upload-post.composer.hashtagHint') }}
        </p>
      </div>

      <!-- Step 5: schedule / queue / now -->
      <ScheduleForm
        v-show="state.step === 'schedule'"
        v-model:mode="state.scheduleMode"
        v-model:scheduled-date="state.scheduledDate"
      />

      <div v-if="state.step !== 'format' || true" class="flex items-center justify-between">
        <button
          type="button"
          class="btn btn-ghost"
          :disabled="stepIndex === 0"
          @click="composer.back()"
        >
          {{ t('ext.upload-post.common.back') }}
        </button>
        <div class="flex gap-2">
          <button
            v-if="state.step !== 'schedule'"
            type="button"
            class="btn btn-primary"
            :disabled="!composer.canProceed.value"
            @click="composer.next()"
          >
            {{ t('ext.upload-post.common.continue') }}
          </button>
          <button
            v-if="state.step === 'schedule'"
            type="button"
            class="btn btn-primary"
            :disabled="!composer.canProceed.value || isDispatching"
            @click="onDispatch"
          >
            <span
              v-if="isDispatching"
              class="loading loading-spinner loading-xs"
            />
            {{ t('ext.upload-post.composer.publish') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>