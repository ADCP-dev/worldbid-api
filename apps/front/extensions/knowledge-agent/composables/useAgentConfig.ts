/**
 * Composable for the Knowledge Agent admin settings (agent configs, model
 * providers, models, MCP servers).
 */

export interface AgentConfig {
  id: string;
  name: string;
  systemPrompt: string;
  model: string;
  provider: string;
  permissions: { allow: string[]; deny: string[] };
  mcpServerIds: string[];
  /** Creator provenance — metadata only, NOT scoping. Configs are global. */
  userId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModelProvider {
  id: string;
  name: string;
  provider: string;
  apiKeyRef: string | null;
  baseUrl: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Model {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  contextWindow: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface McpServer {
  id: string;
  agentConfigId: string | null;
  name: string;
  transport: string;
  url: string;
  apiKeyRef: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentConfigPayload {
  name: string;
  systemPrompt: string;
  model: string;
  provider: string;
  permissions?: { allow: string[]; deny: string[] };
  mcpServerIds?: string[];
}

export interface UpdateAgentConfigPayload {
  name?: string;
  systemPrompt?: string;
  model?: string;
  provider?: string;
  permissions?: { allow: string[]; deny: string[] };
  mcpServerIds?: string[];
}

export interface CreateModelProviderPayload {
  name: string;
  provider: string;
  apiKeyRef?: string;
  baseUrl?: string;
  enabled?: boolean;
}

export interface CreateModelPayload {
  providerId: string;
  modelId: string;
  displayName: string;
  contextWindow: number;
  active?: boolean;
}

function useApi() {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();
  const baseUrl = config.public.apiUrl as string;
  const apiPrefix = (config.public.apiPrefix as string) || '/api/v1';

  async function apiFetch<T>(
    path: string,
    options: {
      method?: string;
      query?: Record<string, unknown>;
      body?: unknown;
    } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (authStore.token) {
      headers.Authorization = `Bearer ${authStore.token}`;
    }
    return (await $fetch(`${baseUrl}${apiPrefix}${path}`, {
      method: options.method,
      query: options.query,
      body: options.body as BodyInit | Record<string, unknown> | null | undefined,
      headers,
    })) as T;
  }

  return { apiFetch };
}

export function useAgentConfig() {
  const { apiFetch } = useApi();

  async function getAgentConfigs(): Promise<AgentConfig[]> {
    return apiFetch<AgentConfig[]>('/ka/agent-configs');
  }

  async function getAgentConfig(id: string): Promise<AgentConfig | null> {
    return apiFetch<AgentConfig | null>(`/ka/agent-configs/${id}`);
  }

  async function createAgentConfig(
    payload: CreateAgentConfigPayload,
  ): Promise<AgentConfig> {
    return apiFetch<AgentConfig>('/ka/agent-configs', {
      method: 'POST',
      body: payload,
    });
  }

  async function updateAgentConfig(
    id: string,
    payload: UpdateAgentConfigPayload,
  ): Promise<AgentConfig> {
    return apiFetch<AgentConfig>(`/ka/agent-configs/${id}`, {
      method: 'PATCH',
      body: payload,
    });
  }

  async function deleteAgentConfig(id: string): Promise<void> {
    await apiFetch(`/ka/agent-configs/${id}`, { method: 'DELETE' });
  }

  return {
    getAgentConfigs,
    getAgentConfig,
    createAgentConfig,
    updateAgentConfig,
    deleteAgentConfig,
  };
}

export function useModelProviders() {
  const { apiFetch } = useApi();

  async function getProviders(): Promise<ModelProvider[]> {
    return apiFetch<ModelProvider[]>('/ka/model-providers');
  }

  async function createProvider(
    payload: CreateModelProviderPayload,
  ): Promise<ModelProvider> {
    return apiFetch<ModelProvider>('/ka/model-providers', {
      method: 'POST',
      body: payload,
    });
  }

  async function getModels(providerId?: string): Promise<Model[]> {
    const query = providerId ? { providerId } : undefined;
    return apiFetch<Model[]>('/ka/models', { query });
  }

  async function getActiveModels(): Promise<Model[]> {
    return apiFetch<Model[]>('/ka/models/active');
  }

  async function createModel(payload: CreateModelPayload): Promise<Model> {
    return apiFetch<Model>('/ka/models', { method: 'POST', body: payload });
  }

  return {
    getProviders,
    createProvider,
    getModels,
    getActiveModels,
    createModel,
  };
}

export interface CreateMcpServerPayload {
  agentConfigId?: string;
  name: string;
  transport: string;
  url: string;
  apiKeyRef?: string;
  enabled?: boolean;
}

export interface UpdateMcpServerPayload {
  agentConfigId?: string;
  name?: string;
  transport?: string;
  url?: string;
  apiKeyRef?: string;
  enabled?: boolean;
}

export function useMcpServers() {
  const { apiFetch } = useApi();

  async function getServers(): Promise<McpServer[]> {
    return apiFetch<McpServer[]>('/ka/mcp-servers');
  }

  async function getServer(id: string): Promise<McpServer | null> {
    return apiFetch<McpServer | null>(`/ka/mcp-servers/${id}`);
  }

  async function createServer(
    payload: CreateMcpServerPayload,
  ): Promise<McpServer> {
    return apiFetch<McpServer>('/ka/mcp-servers', {
      method: 'POST',
      body: payload,
    });
  }

  async function updateServer(
    id: string,
    payload: UpdateMcpServerPayload,
  ): Promise<McpServer> {
    return apiFetch<McpServer>(`/ka/mcp-servers/${id}`, {
      method: 'PATCH',
      body: payload,
    });
  }

  async function deleteServer(id: string): Promise<void> {
    await apiFetch(`/ka/mcp-servers/${id}`, { method: 'DELETE' });
  }

  return {
    getServers,
    getServer,
    createServer,
    updateServer,
    deleteServer,
  };
}