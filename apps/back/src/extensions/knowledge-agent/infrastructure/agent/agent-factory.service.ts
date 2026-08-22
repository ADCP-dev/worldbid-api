import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AgentConfigRepository } from '../agent-config.repository';
import { ToolRegistryService } from './tool-registry.service';
import { McpLoaderService } from './mcp-loader.service';
import { SandboxService } from './sandbox.service';
import { NoteService } from '../../note.service';
import { VectorStoreService } from '../vector-store.service';
import { createKnowledgeAgentTools } from '../../agent.tools';
import { createExecuteTool } from '../../tools/execute.tool';
import type { AgentConfig } from '../../domain/agent-config';
import type { StructuredTool } from '@langchain/core/tools';

interface CachedAgent {
  agent: unknown;
  hash: string;
}

/**
 * AgentFactoryService — builds a compiled DeepAgent from an AgentConfig row.
 *
 * Flow (Context7-verified deepagents API):
 *   1. Load AgentConfig from DB by id (scoped to userId).
 *   2. Hash the mutable config fields → cache key.
 *   3. Cache hit with matching hash → return cached agent (<1s).
 *   4. Cache miss → collect KB tools (scoped to userId) + native tools
 *      (ToolRegistry) + MCP tools (McpLoader) + execute tool (sandbox
 *      backend), create a VfsBackend, call
 *      `createDeepAgent({ model, systemPrompt, tools, backend, permissions })`,
 *      cache and return.
 *
 * Cache invalidation: any change to systemPrompt, model, permissions, or
 * mcpServerIds produces a new hash → rebuild on next call. The KB tools are
 * userId-scoped so the cache key includes the userId passed at build time.
 */
@Injectable()
export class AgentFactoryService {
  private readonly logger = new Logger(AgentFactoryService.name);
  private readonly cache = new Map<string, CachedAgent>();

  constructor(
    private readonly agentConfigRepo: AgentConfigRepository,
    private readonly toolRegistry: ToolRegistryService,
    private readonly mcpLoader: McpLoaderService,
    private readonly sandbox: SandboxService,
    private readonly noteService: NoteService,
    private readonly vectorStoreService: VectorStoreService,
  ) {}

  /**
   * Build (or return cached) DeepAgent for `configId` owned by `userId`.
   * Throws `NotFoundException` if the config is missing or belongs to another
   * user — never leaks cross-user configs.
   */
  async buildAgent(configId: string, userId: number): Promise<unknown> {
    const config = await this.agentConfigRepo.findById(configId);
    if (!config || config.userId !== userId) {
      throw new NotFoundException(`AgentConfig ${configId} not found`);
    }

    const hash = this.hashConfig(config, userId);
    const cacheKey = `${configId}:${userId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.hash === hash) {
      this.logger.debug(`Cache hit for agent ${configId} (user ${userId})`);
      return cached.agent;
    }

    this.logger.log(`Building agent ${configId} (cache miss, user ${userId})`);
    const agent = await this.constructAgent(config, userId);
    this.cache.set(cacheKey, { agent, hash });
    return agent;
  }

  private async constructAgent(
    config: AgentConfig,
    userId: number,
  ): Promise<unknown> {
    const sessionId = `${config.id}:${userId}:${Date.now()}`;
    const backend = await this.sandbox.createSandbox(sessionId);

    // KB tools — userId-scoped (search/create/update/delete notes).
    const kbTools = createKnowledgeAgentTools({
      noteService: this.noteService,
      vectorStoreService: this.vectorStoreService,
      userId,
    });

    // Native tools (auto-discovered from agent.tools.ts across extensions)
    // + MCP tools (external servers declared in config).
    const nativeTools = await this.toolRegistry.collect();
    const mcpTools = await this.mcpLoader.load(config.mcpServerIds);

    // Execute tool — bound to this agent's sandbox backend.
    const executeTool = createExecuteTool(backend);

    const tools: StructuredTool[] = [
      ...kbTools,
      ...nativeTools,
      ...mcpTools,
      executeTool,
    ];

    const permissions = this.sandbox.buildPermissions(
      this.sandbox.workingDir(sessionId),
    );

    return await this.createDeepAgentImpl({
      model: config.model,
      systemPrompt: config.systemPrompt,
      tools,
      backend,
      permissions,
    });
  }

  /** Hash the mutable fields that should invalidate the cache. */
  private hashConfig(config: AgentConfig, userId: number): string {
    const payload = JSON.stringify({
      systemPrompt: config.systemPrompt,
      model: config.model,
      permissions: config.permissions,
      mcpServerIds: [...config.mcpServerIds].sort(),
      userId,
    });
    return createHash('sha1').update(payload).digest('hex');
  }

  /** Wrapper around createDeepAgent — stubbed in tests. */
  protected async createDeepAgentImpl(opts: {
    model: string;
    systemPrompt: string;
    tools: StructuredTool[];
    backend: unknown;
    permissions: unknown;
  }): Promise<unknown> {
    // Lazy import: deepagents pulls in langchain/testing at module load which
    // is not exported by the installed @langchain/core. Loading it lazily keeps
    // the extension boot resilient when the dependency tree is mid-upgrade.
    const { createDeepAgent } = await import('deepagents');
    return createDeepAgent(opts as never);
  }
}