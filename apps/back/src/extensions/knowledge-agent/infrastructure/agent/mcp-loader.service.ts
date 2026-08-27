import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import type { StructuredTool } from '@langchain/core/tools';
import { McpServerRepository } from '../mcp-server.repository';
import { McpServer } from '../../domain/mcp-server';

const MCP_TIMEOUT_MS = 3000;

interface McpServerConfig {
  transport: 'http' | 'stdio';
  url?: string;
  command?: string;
  args?: string[];
  headers?: Record<string, string>;
}

/**
 * McpLoaderService — loads tools from MCP servers registered in the DB plus
 * the local McpModule (internal HTTP server).
 *
 * Uses `MultiServerMCPClient` from `@langchain/mcp-adapters` (Context7-verified).
 * Each server is loaded with a 3s timeout (NFR-010 graceful degradation): if a
 * server is down or slow, it is skipped with a warning and the agent build is
 * NOT blocked.
 */
@Injectable()
export class McpLoaderService {
  private readonly logger = new Logger(McpLoaderService.name);

  constructor(
    private readonly mcpServerRepo: McpServerRepository,
    private readonly config: ConfigService,
  ) {}

  /**
   * Load MCP tools for the given server ids (from an AgentConfig) plus the
   * local McpModule. Returns `[]` if every server is unreachable — never throws.
   */
  async load(mcpServerIds: string[]): Promise<StructuredTool[]> {
    const servers = await this.mcpServerRepo.findEnabledByIds(mcpServerIds);
    const config = this.buildClientConfig(servers);
    if (Object.keys(config).length === 0) return [];

    const client = this.createMcpClient(config);
    try {
      return await Promise.race([
        client.getTools(),
        this.timeout(MCP_TIMEOUT_MS),
      ]);
    } catch (err) {
      this.logger.warn(
        `MCP load failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }

  /** Build the config map consumed by MultiServerMCPClient. */
  private buildClientConfig(
    servers: McpServer[],
  ): Record<string, McpServerConfig> {
    const config: Record<string, McpServerConfig> = {};

    for (const s of servers) {
      if (s.transport === 'http' && s.url) {
        config[s.name] = {
          transport: 'http',
          url: s.url,
          ...(s.headers ? { headers: s.headers } : {}),
        };
      } else if (s.transport === 'stdio' && s.url) {
        config[s.name] = { transport: 'stdio', command: s.url, args: [] };
      }
      // Skip servers with no URL/command (graceful).
    }

    const localUrl = this.config.get<string>('ka.localMcpUrl');
    if (localUrl) {
      config['__local_introspection__'] = { transport: 'http', url: localUrl };
    }
    return config;
  }

  /** Reject after `ms` so `Promise.race` enforces the MCP timeout. */
  private timeout(ms: number): Promise<StructuredTool[]> {
    return new Promise((resolve) =>
      setTimeout(() => {
        this.logger.warn(`MCP load timed out after ${ms}ms`);
        resolve([]);
      }, ms),
    );
  }

  /** Create the MCP client. Extracted so tests can stub it. */
  protected createMcpClient(
    config: Record<string, McpServerConfig>,
  ): MultiServerMCPClient {
    return new MultiServerMCPClient(config as never);
  }
}
