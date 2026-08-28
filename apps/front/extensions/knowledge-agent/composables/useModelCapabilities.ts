import { computed, type Ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';

export interface ModelCapabilities {
  /** Input modalities the model accepts: text, image, file (PDF), audio. */
  modalities: string[];
}

/**
 * Resolve what the currently selected agent model can read (text, images,
 * PDFs, audio) via the backend proxy (GET /ka/model-providers/capabilities).
 *
 * Used by the chat input to unlock/lock attachment types: the upload menu
 * only enables what the model actually supports, so users don't send a
 * vision model a PDF it can't ingest (or a text model an image).
 *
 * `model` is the agent config model string, e.g. "openrouter:z-ai/glm-5.3-flash".
 */
export function useModelCapabilities(model: Ref<string | null | undefined>) {
  const query = useQuery({
    queryKey: computed(() => ['ka-model-capabilities', model.value ?? '']),
    queryFn: async (): Promise<ModelCapabilities> => {
      const m = model.value;
      if (!m) return { modalities: ['text'] };
      const api = useApi();
      return api.get<ModelCapabilities>('/ka/model-providers/capabilities', {
        query: { model: m },
      });
    },
    staleTime: 5 * 60 * 1000,
  });

  const modalities = computed<string[]>(() => query.data.value?.modalities ?? ['text']);
  const canImage = computed(() => modalities.value.includes('image'));
  const canPdf = computed(() => modalities.value.includes('file'));
  const canAudio = computed(() => modalities.value.includes('audio'));
  // Plain-text files are always readable — they are decoded server-side and
  // inlined into the prompt, no special modality required.
  const canTextFile = computed(() => true);

  return { modalities, canImage, canPdf, canAudio, canTextFile, isLoading: query.isLoading };
}
