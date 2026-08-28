import { ref } from 'vue';
import type { ModelProvider } from './useAgentConfig';

export interface ProviderModel {
  id: string;
  name: string;
}

/**
 * Fetch available models from a provider's API via the backend proxy
 * (GET /ka/model-providers/:id/models). The backend does server-side
 * fetches to avoid CORS issues — the browser can't call ollama.com or
 * openrouter.ai directly.
 */
export function useProviderModels() {
  const models = ref<ProviderModel[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchModels(provider: ModelProvider | null): Promise<void> {
    models.value = [];
    error.value = null;
    if (!provider || !provider.enabled) return;

    loading.value = true;
    try {
      const api = useApi();
      const data = await api.get<ProviderModel[]>(`/ka/model-providers/${provider.id}/models`);
      models.value = data ?? [];
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  return { models, loading, error, fetchModels };
}