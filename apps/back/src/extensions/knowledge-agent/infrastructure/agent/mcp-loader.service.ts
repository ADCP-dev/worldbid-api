import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import type { StructuredTool } from '@langchain/core/tools';
import { McpServerRepository } from '../mcp-server.repository';
import { McpServer } from '../../domain/mcp-server';

// Remote MCPs (Tavily, etc.) often need 5-15s for the streamable HTTP
// handshake + tool enumeration. Each server load is raced at this budget so
// one slow server cannot stall the whole agent build.
const MCP_TIMEOUT_MS = 20_000;

interface McpServerConfig {
  transport: 'http' | 'stdio';
  url?: string;
  command?: string;
  args?: string[];
  headers?: Record<string, string>;
}

interface ClientCacheEntry {
  client: MultiServerMCPClient;
  signature: string;
}

/**
 * McpLoaderService — loads tools from MCP servers registered in the DB.
 *
 * Uses `MultiServerMCPClient` from `@langchain/mcp-adapters`. Each server
 * gets its OWN client so a dead/misconfigured server can never poison the
 * batch (NFR-010 graceful degradation):
 *   - invalid rows are pre-filtered (transport not http/stdio, blank url)
 *   - per-server load is raced at MCP_TIMEOUT_MS (20s)
 *   - a failing server logs a warning and is skipped — never throws
 *
 * Clients are cached per server (keyed by a connection signature of
 * transport+url+resolved headers) and kept ALIVE after load: getTools()
 * returns lazy wrappers bound to the client session — closing after load
 * made every later tool invocation fail with "Error: Not connected"
 * (verified live with Tavily: tools listed fine, each call errored).
 */
@Injectable()
export class McpLoaderService {
  private readonly logger = new Logger(McpLoaderService.name);
  private readonly clients = new Map<string, ClientCacheEntry>();
  private readonly warnedMissingEnvRefs = new Set<string>();

  constructor(
    private readonly mcpServerRepo: McpServerRepository,
    private readonly config: ConfigService,
  ) {}

  /**
   * Load MCP tools for the given server ids (from an AgentConfig). Returns
   * `[]` if every server is unreachable — never throws. A failing server
   * only contributes zero tools; healthy servers always load.
   */
  async load(mcpServerIds: string[]): Promise<StructuredTool[]> {
    const servers = await this.resolveServers(mcpServerIds);
    const results = await Promise.allSettled(
      servers.map((s) => this.loadToolsFromServer(s)),
    );
    return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  }

  /**
   * Stable cache-invalidation signature over the effective MCP server set:
   * transport+url+headers+enabled (and the env var NAME — never the secret
   * value). AgentFactoryService mixes this into the agent cache hash so
   * editing an MCP row rebuilds cached agents.
   */
  async getSnapshotKey(mcpServerIds: string[]): Promise<string> {
    const servers = await this.resolveServers(mcpServerIds);
    const fingerprint = servers
      .map((s) => ({
        id: s.id,
        name: s.name,
        transport: s.transport,
        url: s.url,
        apiKeyRef: s.apiKeyRef,
        enabled: s.enabled,
        headers: s.headers ?? null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    return createHash('sha1').update(JSON.stringify(fingerprint)).digest('hex');
  }

  private async resolveServers(mcpServerIds: string[]): Promise<McpServer[]> {
    // Empty assignment list = "use every enabled server" (integration menu
    // connections like Tavily are globally available, not per-agent grants).
    // Non-empty list = explicit per-agent selection.
    return mcpServerIds.length > 0
      ? this.mcpServerRepo.findEnabledByIds(mcpServerIds)
      : this.mcpServerRepo.findAllEnabled();
  }

  /** Load one server's tools. Failures degrade to `[]` for that server only. */
  private async loadToolsFromServer(s: McpServer): Promise<StructuredTool[]> {
    const config = this.buildConfigForServer(s);
    if (!config) {
      this.logger.warn(
        `MCP server "${s.name}" skipped: transport "${s.transport}" needs url/command`,
      );
      return [];
    }

    const signature = this.connectionSignature(config);
    const client = await this.acquireClient(s.id, signature, config);
    try {
      return await this.raceWithTimeout(client.getTools(), MCP_TIMEOUT_MS);
    } catch (err) {
      this.logger.warn(
        `MCP server "${s.name}" failed to load tools: ${err instanceof Error ? err.message : String(err)}`,
      );
      await this.closeClient(client);
      if (this.clients.get(s.id)?.client === client) {
        this.clients.delete(s.id);
      }
      return [];
    }
  }

  /**
   * Reuse an already-connected client for `serverId` when its connection
   * signature is unchanged; otherwise close the stale one and connect fresh.
   */
  private async acquireClient(
    serverId: string,
    signature: string,
    config: Record<string, McpServerConfig>,
  ): Promise<MultiServerMCPClient> {
    const cached = this.clients.get(serverId);
    if (cached && cached.signature === signature) {
      return cached.client;
    }
    if (cached) {
      await this.closeClient(cached.client);
    }
    const client = this.createMcpClient(config);
    this.clients.set(serverId, { client, signature });
    return client;
  }

  /** Build the single-entry config map consumed by MultiServerMCPClient. */
  private buildConfigForServer(
    s: McpServer,
  ): Record<string, McpServerConfig> | null {
    const cfg: Record<string, McpServerConfig> = {};
    if (s.transport === 'http' && s.url) {
      cfg[s.name] = {
        transport: 'http',
        url: s.url,
        headers: this.resolveHeaders(s),
      };
    } else if (s.transport === 'stdio' && s.url) {
      cfg[s.name] = { transport: 'stdio', command: s.url, args: [] };
    } else {
      return null;
    }
    return cfg;
  }

  /**
   * Merge stored headers with the apiKeyRef-injected Authorization bearer.
   * `apiKeyRef` holds the NAME of an env var holding the secret. Injection
   * happens only when the headers map has no Authorization key (case
   * insensitively) — an explicit header always wins. Missing env vars warn
   * once per server+ref and skip injection; secret values are never logged
   * or stored.
   */
  private resolveHeaders(s: McpServer): Record<string, string> | undefined {
    const headers: Record<string, string> = { ...(s.headers ?? {}) };
    const hasAuthHeader = Object.keys(headers).some(
      (k) => k.toLowerCase() === 'authorization',
    );
    if (!s.apiKeyRef) {
      return Object.keys(headers).length > 0 ? headers : undefined;
    }
    if (hasAuthHeader) {
      return headers;
    }
    const secret = process.env[s.apiKeyRef];
    if (!secret) {
      this.warnMissingEnvRefOnce(s);
      return Object.keys(headers).length > 0 ? headers : undefined;
    }
    headers['Authorization'] = `Bearer ${secret}`;
    return headers;
  }

  private warnMissingEnvRefOnce(s: McpServer): void {
    const key = `${s.id}:${s.apiKeyRef}`;
    if (this.warnedMissingEnvRefs.has(key)) return;
    this.warnedMissingEnvRefs.add(key);
    this.logger.warn(
      `MCP server "${s.name}" refers to env var ${s.apiKeyRef ?? ''} which is not set — no Authorization header injected`,
    );
  }

  /** Hash the resolved connection so config changes force a fresh client. */
  private connectionSignature(cfg: Record<string, McpServerConfig>): string {
    return createHash('sha1').update(JSON.stringify(cfg)).digest('hex');
  }

  /** Reject after `ms` so `Promise.race` enforces the per-server timeout. */
  private async raceWithTimeout(
    p: Promise<StructuredTool[]>,
    ms: number,
  ): Promise<StructuredTool[]> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        p,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`timed out after ${ms}ms`)),
            ms,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Close a client, swallowing close-time errors (stale/failed clients). */
  private async closeClient(client: MultiServerMCPClient): Promise<void> {
    try {
      await client.close?.();
    } catch {
      // close() failures must not break the load flow.
    }
  }

  /** Create the MCP client. Extracted so tests can stub it. */
  protected createMcpClient(
    config: Record<string, McpServerConfig>,
  ): MultiServerMCPClient {
    return new MultiServerMCPClient(config as never);
  }
}
