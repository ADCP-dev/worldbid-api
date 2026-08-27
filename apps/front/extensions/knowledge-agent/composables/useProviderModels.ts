import { ref } from 'vue';
import type { ModelProvider } from './useAgentConfig';

export interface ProviderModel {
  id: string;
  name: string;
}

/**
 * Fetch available models directly from a provider's API (Ollama /api/tags,
 * OpenRouter /api/v1/models). Models are NOT stored in the DB — only the
 * user's choice is persisted in AgentConfig.model.
 *
 * The apiKey is read from the provider's `apiKeyRef` (env var name OR
 * literal value if no env var exists — same fallback as ModelResolverService).
 */
export function useProviderModels() {
  const models = ref<ProviderModel[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchFromOllama(baseUrl: string, apiKey?: string): Promise<ProviderModel[]> {
    // ChatOllama / the Ollama API use /api/tags. Some providers store the
    // baseUrl WITH a trailing /api (Ollama Cloud: https://ollama.com/api).
    // Normalize: strip trailing /api so we don't get /api/api/tags.
    let url = baseUrl.replace(/\/$/, '');
    url = url.replace(/\/api\/?$/, '');
    url += '/api/tags';
    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const resp = await fetch(url, { headers });
    if (!resp.ok) throw new Error(`Ollama ${resp.status}: ${resp.statusText}`);
    const data = await resp.json() as { models?: Array<{ name: string; details?: { parameter_size?: string } }> };
    return (data.models ?? []).map((m) => ({
      id: m.name,
      name: m.details?.parameter_size ? `${m.name} (${m.details.parameter_size})` : m.name,
    }));
  }

  async function fetchFromOpenRouter(baseUrl: string, apiKey?: string): Promise<ProviderModel[]> {
    const url = baseUrl.replace(/\/$/, '') + '/models';
    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const resp = await fetch(url, { headers });
    if (!resp.ok) throw new Error(`OpenRouter ${resp.status}: ${resp.statusText}`);
    const data = await resp.json() as { data?: Array<{ id: string; name?: string; pricing?: { prompt: string } }> };
    return (data.data ?? []).map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
    }));
  }

  async function fetchModels(provider: ModelProvider | null): Promise<void> {
    models.value = [];
    error.value = null;
    if (!provider || !provider.enabled) return;

    loading.value = true;
    try {
      const apiKey = provider.apiKeyRef
        ? (import.meta.env?.[provider.apiKeyRef] ?? provider.apiKeyRef)
        : undefined;

      if (provider.provider === 'ollama' || provider.provider === 'ollama-cloud') {
        models.value = await fetchFromOllama(provider.baseUrl || 'http://127.0.0.1:11434', apiKey);
      } else if (provider.provider === 'openrouter' || provider.provider === 'openai') {
        models.value = await fetchFromOpenRouter(
          provider.baseUrl || (provider.provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1'),
          apiKey,
        );
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  return { models, loading, error, fetchModels };
}