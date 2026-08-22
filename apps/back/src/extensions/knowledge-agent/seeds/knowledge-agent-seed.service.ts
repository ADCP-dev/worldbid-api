import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelProviderEntity } from '../infrastructure/entities/model-provider.entity';
import { ModelEntity } from '../infrastructure/entities/model.entity';
import { AgentConfigEntity } from '../infrastructure/entities/agent-config.entity';

/**
 * Idempotent seed for the knowledge-agent extension.
 *
 * Seeds:
 *   - ModelProvider: Ollama (local, base_url configurable) + OpenRouter
 *     (api_key_ref OPENROUTER_API_KEY).
 *   - Model: glm-5.2 on OpenRouter, active=true (default agent model).
 *   - AgentConfig default: "Knowledge Agent" with a basic system prompt and
 *     model "openrouter:z-ai/glm-5.2".
 *
 * Fixed UUIDs make re-runs safe (upsert-by-id). The default agent config is
 * assigned to user id 1 (the seeded admin) — other users create their own
 * configs via the controller.
 */
@Injectable()
export class KnowledgeAgentSeedService {
  private readonly logger = new Logger(KnowledgeAgentSeedService.name);

  private static readonly OLLAMA_PROVIDER_ID =
    '00000000-0000-0000-0000-000000000001';
  private static readonly OPENROUTER_PROVIDER_ID =
    '00000000-0000-0000-0000-000000000002';
  private static readonly GLM52_MODEL_ID =
    '00000000-0000-0000-0000-000000000003';
  private static readonly DEFAULT_AGENT_CONFIG_ID =
    '00000000-0000-0000-0000-000000000004';

  constructor(
    @InjectRepository(ModelProviderEntity)
    private readonly providerRepo: Repository<ModelProviderEntity>,
    @InjectRepository(ModelEntity)
    private readonly modelRepo: Repository<ModelEntity>,
    @InjectRepository(AgentConfigEntity)
    private readonly agentConfigRepo: Repository<AgentConfigEntity>,
  ) {}

  async run() {
    await this.seedOllamaProvider();
    await this.seedOpenRouterProvider();
    await this.seedGlmModel();
    await this.seedDefaultAgentConfig();
  }

  private async seedOllamaProvider(): Promise<void> {
    const id = KnowledgeAgentSeedService.OLLAMA_PROVIDER_ID;
    const existing = await this.providerRepo.findOne({ where: { id } });
    const data = {
      name: 'Ollama (local)',
      provider: 'ollama',
      apiKeyRef: null,
      baseUrl: process.env.KA_OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434',
      enabled: true,
    };
    if (!existing) {
      await this.providerRepo.save(
        this.providerRepo.create({ id, ...data }),
      );
      this.logger.log('Seeded Ollama model provider');
    } else {
      let changed = false;
      for (const key of Object.keys(data) as (keyof typeof data)[]) {
        if (existing[key] !== data[key]) {
          (existing[key] as unknown) = data[key];
          changed = true;
        }
      }
      if (changed) {
        await this.providerRepo.save(existing);
        this.logger.log('Updated Ollama model provider');
      }
    }
  }

  private async seedOpenRouterProvider(): Promise<void> {
    const id = KnowledgeAgentSeedService.OPENROUTER_PROVIDER_ID;
    const existing = await this.providerRepo.findOne({ where: { id } });
    const data = {
      name: 'OpenRouter',
      provider: 'openrouter',
      apiKeyRef: 'OPENROUTER_API_KEY',
      baseUrl: 'https://openrouter.ai/api/v1',
      enabled: true,
    };
    if (!existing) {
      await this.providerRepo.save(
        this.providerRepo.create({ id, ...data }),
      );
      this.logger.log('Seeded OpenRouter model provider');
    } else {
      let changed = false;
      for (const key of Object.keys(data) as (keyof typeof data)[]) {
        if (existing[key] !== data[key]) {
          (existing[key] as unknown) = data[key];
          changed = true;
        }
      }
      if (changed) {
        await this.providerRepo.save(existing);
        this.logger.log('Updated OpenRouter model provider');
      }
    }
  }

  private async seedGlmModel(): Promise<void> {
    const id = KnowledgeAgentSeedService.GLM52_MODEL_ID;
    const providerId = KnowledgeAgentSeedService.OPENROUTER_PROVIDER_ID;
    const existing = await this.modelRepo.findOne({ where: { id } });
    const data = {
      providerId,
      modelId: 'z-ai/glm-5.2',
      displayName: 'GLM 5.2 (OpenRouter)',
      contextWindow: 128000,
      active: true,
    };
    if (!existing) {
      await this.modelRepo.save(this.modelRepo.create({ id, ...data }));
      this.logger.log('Seeded glm-5.2 model');
    } else {
      let changed = false;
      for (const key of Object.keys(data) as (keyof typeof data)[]) {
        if (existing[key] !== data[key]) {
          (existing[key] as unknown) = data[key];
          changed = true;
        }
      }
      if (changed) {
        await this.modelRepo.save(existing);
        this.logger.log('Updated glm-5.2 model');
      }
    }
  }

  private async seedDefaultAgentConfig(): Promise<void> {
    const id = KnowledgeAgentSeedService.DEFAULT_AGENT_CONFIG_ID;
    const existing = await this.agentConfigRepo.findOne({ where: { id } });
    const data = {
      name: 'Knowledge Agent',
      systemPrompt:
        'You are a knowledge agent. You help the user research, organize, and reason about their notes. Use the available tools to search and manage the knowledge base. Be concise and cite your sources.',
      model: 'openrouter:z-ai/glm-5.2',
      provider: 'openrouter',
      permissions: { allow: ['/vfs/**'], deny: [] },
      mcpServerIds: [],
      userId: 1,
    };
    if (!existing) {
      await this.agentConfigRepo.save(
        this.agentConfigRepo.create({ id, ...data }),
      );
      this.logger.log('Seeded default Knowledge Agent config');
    } else {
      let changed = false;
      for (const key of Object.keys(data) as (keyof typeof data)[]) {
        if (existing[key] !== data[key]) {
          (existing[key] as unknown) = data[key];
          changed = true;
        }
      }
      if (changed) {
        await this.agentConfigRepo.save(existing);
        this.logger.log('Updated default Knowledge Agent config');
      }
    }
  }
}