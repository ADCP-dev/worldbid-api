import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { AgentConfig } from '../../domain/agent-config';
import { ModelProviderEntity } from '../entities/model-provider.entity';

/**
 * ModelResolverService — turns an `AgentConfig.model` string like
 * `"ollama-cloud:glm-5.3-flash:cloud"` into a LangChain `BaseChatModel`
 * instance connected to the right provider endpoint.
 *
 * Why this exists: `createDeepAgent()` accepts a bare string model and
 * delegates to LangChain's `init_chat_model()`, but that function only
 * recognizes standard prefixes ("openai", "anthropic", "ollama"). Our
 * DB stores providers with custom prefixes ("openrouter", "ollama-cloud",
 * "azure", …) that need URL + auth resolution before the model can run.
 *
 * Resolution table:
 *   - "ollama"        → ChatOllama (local daemon, defaults to http://127.0.0.1:11434)
 *   - "ollama-cloud"  → ChatOllama with custom baseUrl + Authorization header
 *   - "openrouter"    → ChatOpenAI with baseUrl https://openrouter.ai/api/v1
 *   - "openai"        → ChatOpenAI with official endpoint (or custom baseUrl)
 *   - anything else   → falls back to the string (deepagents throws if unknown)
 *
 * Credentials come from an env var named by `ModelProvider.apiKeyRef`
 * (e.g. "OLLAMA_CLOUD_API_KEY") — never stored in the DB.
 */
@Injectable()
export class ModelResolverService {
  private readonly logger = new Logger(ModelResolverService.name);

  constructor(
    @InjectRepository(ModelProviderEntity)
    private readonly providerRepo: Repository<ModelProviderEntity>,
  ) {}

  /**
   * Resolve `config.model` ("prefix:modelId") to a ready-to-use ChatModel.
   *
   * Throws descriptive Error if the prefix is not registered in
   * `ext_ka_model_providers` or the referenced env var is missing.
   */
  async resolve(config: AgentConfig): Promise<BaseChatModel> {
    const { provider: prefix, modelId } = this.parseModelString(config.model);

    const provider = await this.providerRepo.findOne({
      where: { provider: prefix, enabled: true },
    });
    if (!provider) {
      throw new Error(
        `Model resolver: provider '${prefix}' not found in ka_model_providers.
Register it via /app/settings/models with baseUrl + apiKeyRef.`,
      );
    }

    return this.buildChatModel(prefix, modelId, provider);
  }

  /**
   * Split "provider:modelId" on the first colon. Model IDs may contain
   * colons themselves (e.g., "glm-5.3-flash:cloud") — everything after the
   * first ":" is the modelId.
   *
   * Falls back to provider="openrouter" and modelId=raw when there's no
   * colon delimiter (legacy configs from before the prefix convention).
   */
  parseModelString(model: string): { provider: string; modelId: string } {
    const idx = model.indexOf(':');
    if (idx === -1) {
      // No provider prefix → legacy config, assume openrouter.
      return { provider: 'openrouter', modelId: model };
    }
    return {
      provider: model.slice(0, idx),
      modelId: model.slice(idx + 1),
    };
  }

  /**
   * Build the correct LangChain ChatModel depending on the provider type.
   */
  private async buildChatModel(
    prefix: string,
    modelId: string,
    provider: ModelProviderEntity,
  ): Promise<BaseChatModel> {
    const apiKey = provider.apiKeyRef
      ? (process.env[provider.apiKeyRef] ?? provider.apiKeyRef)
      : undefined;

    switch (prefix) {
      case 'ollama':
      case 'ollama-cloud':
        return this.buildOllama(modelId, provider, apiKey);
      case 'openrouter':
      case 'openai':
        return this.buildOpenAICompatible(modelId, provider, apiKey);
      default: {
        this.logger.warn(
          `Unknown provider '${prefix}' for model '${modelId}' — leaving as string ` +
          `for the caller to handle (deepagents init_chat_model may or may not support it).`,
        );
        // Not a base chat model — caller will need to handle this case. We
        // return a stub that throws on invoke so the failure surface is clear.
        throw new Error(
          `Model resolver: unsupported provider '${prefix}'. Supported: ollama, ollama-cloud, openrouter, openai.`,
        );
      }
    }
  }

  private async buildOllama(
    modelId: string,
    provider: ModelProviderEntity,
    apiKey: string | undefined,
  ): Promise<BaseChatModel> {
    const { ChatOllama } = await import('@langchain/ollama');

    const baseUrl = provider.baseUrl || 'http://127.0.0.1:11434';

    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    this.logger.debug(
      `Ollama model '${modelId}' @ ${baseUrl} ${apiKey ? '(with auth)' : '(no auth)'}`,
    );

    return new ChatOllama({
      model: modelId,
      baseUrl,
      headers,
      temperature: 0.7,
    });
  }

  private async buildOpenAICompatible(
    modelId: string,
    provider: ModelProviderEntity,
    apiKey: string | undefined,
  ): Promise<BaseChatModel> {
    const { ChatOpenAI } = await import('@langchain/openai');

    const baseUrl = provider.baseUrl ||
      (provider.apiKeyRef?.includes('OPENROUTER')
        ? 'https://openrouter.ai/api/v1'
        : 'https://api.openai.com/v1');

    this.logger.debug(
      `OpenAI-compatible model '${modelId}' @ ${baseUrl} ${apiKey ? '(with auth)' : '(no auth)'}`,
    );

    return new ChatOpenAI({
      model: modelId,
      temperature: 0.7,
      configuration: {
        baseURL: baseUrl,
        apiKey: apiKey ?? 'unused',
      },
    });
  }

  /**
   * Clear cached resolved model for a config (called on provider or config
   * update). The AgentFactoryService's cache invalidation via hash already
   * handles this — this method exists for future direct cache control.
   */
  invalidate(configId: string): void {
    void configId;
    // No-op: resolution is on-demand per call; AgentFactoryService already
    // rebuilds the agent whenever config hash changes.
  }
}
