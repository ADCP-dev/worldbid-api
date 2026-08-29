import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AgentConfigRepository } from '../agent-config.repository';
import { ToolRegistryService } from './tool-registry.service';
import { McpLoaderService } from './mcp-loader.service';
import { SandboxService } from './sandbox.service';
import { NoteService } from '../../note.service';
import { VectorStoreService } from '../vector-store.service';
import { ModelResolverService } from './model-resolver.service';
import { SqlQueryService } from '../../tools/sql-query.tool';
import { createKnowledgeAgentTools } from '../../agent.tools';
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
 *   1. Load AgentConfig from DB by id (global — no ownership check).
 *   2. Hash the mutable config fields → cache key.
 *   3. Cache hit with matching hash → return cached agent (<1s).
 *   4. Cache miss → collect KB tools (global, no user scoping) + native tools
 *      (ToolRegistry) + MCP tools (McpLoader) + execute tool (sandbox
 *      backend), create a VfsBackend, call
 *      `createDeepAgent({ model, systemPrompt, tools, backend, permissions })`,
 *      cache and return.
 *
 * Cache invalidation: any change to systemPrompt, model, permissions, or
 * mcpServerIds produces a new hash → rebuild on next call. The userId stays
 * in the cache key so per-user ChatSession isolation is preserved even
 * though notes + configs are now global.
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
    private readonly modelResolver: ModelResolverService,
    private readonly sqlQueryService: SqlQueryService,
  ) {}

  /**
   * Build (or return cached) DeepAgent for `configId`. Configs are GLOBAL —
   * no ownership check. `userId` is kept in the cache key so each user gets
   * their own agent instance + sandbox (ChatSession isolation).
   *
   * Throws `NotFoundException` if the config is missing.
   */
  async buildAgent(configId: string, userId: number): Promise<unknown> {
    const config = await this.agentConfigRepo.findById(configId);
    if (!config) {
      throw new NotFoundException(`AgentConfig ${configId} not found`);
    }

    const mcpSignature = await this.getMcpSignature(config);
    const hash = this.hashConfig(config, userId, mcpSignature);
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

  /**
   * Snapshot signature of the effective MCP server set (row state: url,
   * headers, enabled, apiKeyRef name). Edits to an MCP server row change
   * this key → cached agents rebuild. Loader failure degrades gracefully:
   * the signature is cache-invalidation sugar, not a hard dependency.
   */
  private async getMcpSignature(config: AgentConfig): Promise<string> {
    try {
      return await this.mcpLoader.getSnapshotKey(config.mcpServerIds);
    } catch (err) {
      this.logger.warn(
        `MCP snapshot key failed (cache-key fallback): ${err instanceof Error ? err.message : String(err)}`,
      );
      return 'unavailable';
    }
  }

  private async constructAgent(
    config: AgentConfig,
    userId: number,
  ): Promise<unknown> {
    const sessionId = `${config.id}:${userId}:${Date.now()}`;
    const backend = await this.sandbox.createSandbox(sessionId);

    // Resolve the chat model from the provider registry (handles ollama /
    // ollama-cloud / openrouter / openai prefix + baseUrl + apiKey).
    const chatModel = await this.modelResolver.resolve(config);

    // KB tools — global (notes + configs shared across users).
    const kbTools = createKnowledgeAgentTools({
      noteService: this.noteService,
      vectorStoreService: this.vectorStoreService,
    });

    // Native tools (auto-discovered from agent.tools.ts across extensions)
    // + MCP tools (external servers declared in config) + read-only SQL.
    const nativeTools = await this.toolRegistry.collect();
    const mcpTools = await this.mcpLoader.load(config.mcpServerIds);
    const sqlTool = this.sqlQueryService.createTool();

    // NOTE: no custom execute/run_command tool — deepagents wires the full
    // filesystem middleware natively from the VfsBackend (read/write/edit/
    // ls/grep/glob), and VfsBackend has NO execute() method (verified:
    // VfsBackend API = read, readRaw, write, edit, delete, ls, grep, glob).
    // A hand-rolled shell tool against that API always failed with
    // "Sandbox backend is not available".

    const tools: StructuredTool[] = [
      ...kbTools,
      ...nativeTools,
      ...mcpTools,
      sqlTool,
    ];

    const permissions = this.sandbox.buildPermissions(
      this.sandbox.workingDir(sessionId),
    );

    return await this.createDeepAgentImpl({
      model: chatModel,
      systemPrompt: config.systemPrompt,
      tools,
      backend,
      permissions,
    });
  }

  /**
   * Hash the mutable fields that should invalidate the cache. The MCP
   * snapshot signature covers row-level MCP changes (url/headers/enabled/
   * apiKeyRef) that the config object alone cannot see.
   */
  private hashConfig(
    config: AgentConfig,
    userId: number,
    mcpSignature: string,
  ): string {
    const payload = JSON.stringify({
      systemPrompt: config.systemPrompt,
      model: config.model,
      permissions: config.permissions,
      mcpServerIds: [...config.mcpServerIds].sort(),
      mcpSignature,
      userId,
    });
    return createHash('sha1').update(payload).digest('hex');
  }

  /** Wrapper around createDeepAgent — stubbed in tests. */
  protected async createDeepAgentImpl(opts: {
    model: unknown;
    systemPrompt: string;
    tools: StructuredTool[];
    backend: unknown;
    permissions: unknown;
  }): Promise<unknown> {
    // Lazy import: deepagents pulls in langchain/testing at module load which
    // is not exported by the installed @langchain/core. Loading it lazily keeps
    // the extension boot resilient when the dependency tree is mid-upgrade.
    const { createDeepAgent } = (await import('deepagents')) as {
      createDeepAgent: (o: typeof opts) => unknown;
    };
    return createDeepAgent(opts);
  }
}
