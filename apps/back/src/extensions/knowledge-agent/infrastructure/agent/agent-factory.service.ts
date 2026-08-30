import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { AgentConfigRepository } from '../agent-config.repository';
import { ToolRegistryService } from './tool-registry.service';
import { McpLoaderService } from './mcp-loader.service';
import { SandboxService } from './sandbox.service';
import { NoteService } from '../../note.service';
import { VectorStoreService } from '../vector-store.service';
import { ModelResolverService } from './model-resolver.service';
import { SqlQueryService } from '../../tools/sql-query.tool';
import { createShellExecTool } from '../../tools/shell-exec.tool';
import { UsersService } from '@users/users.service';
import { RoleEnum } from '@iam/roles/roles.enum';
import { createJsEvalTool } from '../../tools/js-eval.tool';
import { createCurrentDatetimeTool } from '../../tools/current-datetime.tool';
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
 *      (ToolRegistry) + MCP tools (McpLoader) + the ADMIN-ONLY tools
 *      (`sql_query_readonly` + `run_command` — see below) + the
 *      `execute_js` tool (isolated QuickJS eval via SandboxService) + the
 *      `get_current_datetime` clock tool, create a
 *      VfsBackend, call
 *      `createDeepAgent({ model, systemPrompt, tools, backend, permissions })`,
 *      cache and return.
 *
 * Cache invalidation: any change to systemPrompt, model, permissions, or
 * mcpServerIds produces a new hash → rebuild on next call. The userId stays
 * in the cache key so per-user ChatSession isolation is preserved even
 * though notes + configs are now global.
 *
 * Admin tool gating (security): `sql_query_readonly` and `run_command` are
 * NOT user-scoped — SQL SELECTs can read rows from ext_ka_notes,
 * ext_ka_chat_sessions, users, etc., and the shell tool executes commands
 * inside the backend container (with a stripped environment — it is NOT a
 * hard security boundary; the trust boundary is the admin role). To prevent
 * cross-user exposure and untrusted code execution, both tools are included
 * ONLY when the requesting user has RoleEnum.admin.
 * Non-admin agents never see them. The isAdmin verdict participates in
 * the cache hash so a role change (admin ↔ non-admin) invalidates the cached
 * agent. Resolution failures are fail-closed (treated as non-admin).
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
    private readonly usersService: UsersService,
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
    const isAdmin = await this.resolveIsAdmin(userId);
    const hash = this.hashConfig(config, userId, mcpSignature, isAdmin);
    const cacheKey = `${configId}:${userId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.hash === hash) {
      this.logger.debug(`Cache hit for agent ${configId} (user ${userId})`);
      return cached.agent;
    }

    this.logger.log(`Building agent ${configId} (cache miss, user ${userId})`);
    const agent = await this.constructAgent(config, userId, isAdmin);
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

  /**
   * Whether the requesting user is an admin. `sql_query_readonly` and
   * `run_command` are admin-only because they are NOT user-scoped (cross-user
   * exposure: ext_ka_notes, ext_ka_chat_sessions, users, ...; plus in-container
   * shell execution). FAIL-CLOSED:
   * missing user/role or lookup errors → non-admin (both tools withheld).
   * Role comparison mirrors RolesGuard: compare role ids as strings, since
   * Role.id is `number | string`.
   */
  private async resolveIsAdmin(userId: number): Promise<boolean> {
    try {
      const user = await this.usersService.findById(userId);
      if (!user?.role) {
        this.logger.warn(
          `No role found for user ${userId} — sql_query_readonly withheld (fail-closed)`,
        );
        return false;
      }
      return String(user.role.id) === String(RoleEnum.admin);
    } catch (err) {
      this.logger.warn(
        `Admin check failed for user ${userId} — sql_query_readonly withheld (fail-closed): ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  private async constructAgent(
    config: AgentConfig,
    userId: number,
    isAdmin: boolean,
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
    // + MCP tools (external servers declared in config) + ADMIN-ONLY tools
    // (read-only SQL + shell execution — see resolveIsAdmin) + isolated JS
    // execution + server clock (get_current_datetime).
    const nativeTools = await this.toolRegistry.collect();
    const mcpTools = await this.mcpLoader.load(config.mcpServerIds);
    const jsEvalTool = createJsEvalTool(this.sandbox);
    const currentDatetimeTool = createCurrentDatetimeTool();

    // Stable per-build scratch dir for shell commands (run_command cwd).
    // Derived from config id + user id so the same agent/user pair reuses
    // the same dir across rebuilds, while different users stay isolated.
    const shellWorkDir = join(
      tmpdir(),
      `ka-exec-${createHash('sha1')
        .update(`${config.id}:${userId}`)
        .digest('hex')
        .slice(0, 12)}`,
    );
    const shellExecTool = createShellExecTool({ workDir: shellWorkDir });

    // NOTE on command execution: deepagents wires the full filesystem
    // middleware natively from the VfsBackend (read/write/edit/ls/grep/glob),
    // but VfsBackend has NO execute() method (verified: VfsBackend API =
    // read, readRaw, write, edit, delete, ls, grep, glob) — so shell
    // execution is provided by the dedicated `run_command` tool
    // (spawn /bin/sh -c in the shellWorkDir scratch dir, stripped
    // environment, 30s timeout). JS execution is provided by the isolated
    // QuickJS `execute_js` tool (SandboxService.evalJs — no
    // require/process/network/fs).

    const tools: StructuredTool[] = [
      ...kbTools,
      ...nativeTools,
      ...mcpTools,
      // SECURITY: admin-only gate — sql_query_readonly's SELECTs are NOT
      // user-scoped (cross-user exposure) and run_command executes sh
      // inside the backend container (stripped env, but NOT an OS-level
      // security boundary — admin trust, consistent with the SQL gate).
      ...(isAdmin ? [this.sqlQueryService.createTool(), shellExecTool] : []),
      jsEvalTool,
      currentDatetimeTool,
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
   * apiKeyRef) that the config object alone cannot see. `isAdmin` is part
   * of the hash because it gates the admin-only tools (sql_query_readonly,
   * run_command) — a role change must rebuild the agent with (or without)
   * them.
   */
  private hashConfig(
    config: AgentConfig,
    userId: number,
    mcpSignature: string,
    isAdmin: boolean,
  ): string {
    const payload = JSON.stringify({
      systemPrompt: config.systemPrompt,
      model: config.model,
      permissions: config.permissions,
      mcpServerIds: [...config.mcpServerIds].sort(),
      mcpSignature,
      userId,
      isAdmin,
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
