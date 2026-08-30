import { computed, inject, provide, reactive } from 'vue';
import type { InjectionKey } from 'vue';
import type { UpAspectRatio, UpMediaType } from '../types';
import { platformsFor } from '../lib/platform-matrix';
import { useUploadPostDispatchMutation } from './useUploadPostApi';

/**
 * Composer 5-step state machine (design FR): ratio+mediaType → media →
 * platforms/destinations → caption → schedule/queue/now. State is scoped to
 * one composer lifecycle via provide/inject — no cross-navigation leakage.
 */

export type ComposerStepId =
  | 'format'
  | 'media'
  | 'platforms'
  | 'caption'
  | 'schedule';

export interface ComposerState {
  step: ComposerStepId;
  aspectRatio: UpAspectRatio | null;
  mediaType: UpMediaType | null;
  mediaFiles: File[];
  mediaUrls: string[];
  platforms: string[];
  facebookPageId: string;
  linkedinPageId: string;
  pinterestBoard: string;
  title: string;
  caption: string;
  scheduleMode: 'now' | 'queue' | 'schedule';
  scheduledDate: string;
}

const COMPOSER_KEY: InjectionKey<ComposerState> = Symbol(
  'upload-post-composer',
);

const STEPS: ComposerStepId[] = [
  'format',
  'media',
  'platforms',
  'caption',
  'schedule',
];

function initialState(): ComposerState {
  return {
    step: 'format',
    aspectRatio: null,
    mediaType: null,
    mediaFiles: [],
    mediaUrls: [],
    platforms: [],
    facebookPageId: '',
    linkedinPageId: '',
    pinterestBoard: '',
    title: '',
    caption: '',
    scheduleMode: 'now',
    scheduledDate: '',
  };
}

function isStepComplete(
  state: ComposerState,
  step: ComposerStepId,
): boolean {
  switch (step) {
    case 'format':
      return !!state.aspectRatio && !!state.mediaType;
    case 'media': {
      if (!state.mediaType) return false;
      if (state.mediaType === 'text') return true;
      if (state.mediaType === 'document')
        return state.mediaFiles.length === 1 || state.mediaUrls.length === 1;
      if (state.mediaType === 'video') return state.mediaUrls.length === 1;
      return state.mediaUrls.length + state.mediaFiles.length > 0;
    }
    case 'platforms':
      return state.platforms.length > 0;
    case 'caption':
      return state.mediaType === 'text' ? true : state.caption.trim().length > 0;
    case 'schedule':
      return (
        state.scheduleMode !== 'schedule' || state.scheduledDate.length > 0
      );
    default:
      return false;
  }
}

async function uploadMediaToStorage(files: File[]): Promise<string[]> {
  const config = useRuntimeConfig();
  const auth = useAuthStore();
  const baseUrl = `${config.public.apiUrl}${config.public.apiPrefix}`;
  const urls: string[] = [];
  for (const file of files) {
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('isPublic', 'true');
    const res = await fetch(`${baseUrl}/files/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}` },
      body: fd,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        text.slice(0, 300) || `Storage upload failed (${res.status})`,
      );
    }
    const data = (await res.json()) as { path?: string };
    if (!data.path) throw new Error('Storage upload returned no path');
    urls.push(data.path);
  }
  return urls;
}

export function provideComposer(): ComposerState {
  const state = reactive(initialState());
  provide(COMPOSER_KEY, state);
  return state;
}

export function useComposer() {
  const injected = inject(COMPOSER_KEY);
  if (!injected) {
    throw new Error('useComposer must be used within a provided composer');
  }
  const state: ComposerState = injected;

  const allowedPlatforms = computed<string[]>(() => {
    if (!state.aspectRatio || !state.mediaType) return [];
    return platformsFor(state.aspectRatio, state.mediaType);
  });

  const dispatchMutation = useUploadPostDispatchMutation();

  const needsMediaFile = computed(
    () =>
      state.mediaType === 'video' ||
      state.mediaType === 'photos' ||
      state.mediaType === 'document',
  );

  const canProceed = computed(() => isStepComplete(state, state.step));

  function goTo(step: ComposerStepId) {
    const idx = STEPS.indexOf(step);
    if (idx < 0) return;
    for (const prior of STEPS.slice(0, idx)) {
      if (!isStepComplete(state, prior)) return;
    }
    state.step = step;
  }

  function next() {
    if (!canProceed.value) return;
    const idx = STEPS.indexOf(state.step);
    const nextStep = STEPS[idx + 1];
    if (nextStep) state.step = nextStep;
  }

  function back() {
    const idx = STEPS.indexOf(state.step);
    if (idx > 0) {
      const prev = STEPS[idx - 1];
      if (prev) state.step = prev;
    }
  }

  function reset() {
    Object.assign(state, initialState());
  }

  async function dispatch(): Promise<{
    requestId: string | null;
    localId?: string;
  }> {
    if (!canProceed.value) {
      throw new Error('composer.incompleteStep');
    }
    const mediaType = state.mediaType;
    if (!mediaType) throw new Error('composer.formatRequired');
    if (state.platforms.length === 0) {
      throw new Error('composer.platformsRequired');
    }
    const scheduledDate =
      state.scheduleMode === 'schedule' && state.scheduledDate
        ? state.scheduledDate
        : undefined;
    const base = {
      platforms: [...state.platforms],
      caption: state.caption,
      scheduledDate,
      addToQueue: state.scheduleMode === 'queue',
    };
    const title = state.title || state.caption.slice(0, 60);

    if (mediaType === 'document') {
      if (state.mediaUrls.length === 1) {
        return dispatchMutation.mutateAsync({
          mediaType: 'document',
          title,
          platforms: base.platforms,
          documentUrl: state.mediaUrls[0],
          caption: base.caption,
          scheduledDate: base.scheduledDate,
        });
      }
      const documentFile = state.mediaFiles[0];
      if (!documentFile) throw new Error('composer.mediaRequired');
      return dispatchMutation.mutateAsync({
        mediaType: 'document',
        title,
        platforms: base.platforms,
        documentFile,
        caption: base.caption,
        scheduledDate: base.scheduledDate,
      });
    }
    if (mediaType === 'video') {
      const urls = state.mediaFiles.length
        ? await uploadMediaToStorage(state.mediaFiles)
        : state.mediaUrls;
      const videoUrl = urls[0];
      if (!videoUrl) throw new Error('composer.mediaRequired');
      return dispatchMutation.mutateAsync({
        mediaType: 'video',
        title,
        platforms: base.platforms,
        videoUrl,
        caption: base.caption,
        scheduledDate: base.scheduledDate,
      });
    }
    if (mediaType === 'photos') {
      const urls = state.mediaFiles.length
        ? await uploadMediaToStorage(state.mediaFiles)
        : state.mediaUrls;
      if (urls.length === 0) throw new Error('composer.mediaRequired');
      return dispatchMutation.mutateAsync({
        mediaType: 'photos',
        title,
        platforms: base.platforms,
        photoUrls: urls,
        caption: base.caption,
        scheduledDate: base.scheduledDate,
      });
    }
    return dispatchMutation.mutateAsync({
      mediaType: 'text',
      platforms: base.platforms,
      caption: state.caption,
      title,
      scheduledDate: base.scheduledDate,
    });
  }

  return {
    state,
    steps: STEPS,
    allowedPlatforms,
    needsMediaFile,
    canProceed,
    goTo,
    next,
    back,
    reset,
    dispatch,
  };
}