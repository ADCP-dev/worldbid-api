/**
 * McpController — HTTP transport for MCP introspection tools.
 *
 *   GET  /api/v1/_mcp/tools          → list tools
 *   POST /api/v1/_mcp/tools/:name    → execute tool
 *
 * The introspector bundle + tool registry are built lazily in onModuleInit
 * using ModuleRef to resolve the 'SPEC_LOADED_SPECS' token exported by
 * SpecEngineModule. When the token is absent (no spec engine), the registry
 * falls back to an empty loaded-specs array so the HTTP endpoints still
 * respond (tools return empty results).
 */

import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Logger, NotFoundException, BadRequestException, OnModuleInit, Param, Post } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { LoadedSpec } from '@core/spec-engine/spec-loader';
import { IntrospectionCache } from './introspection-cache';
import { SpecEngineIntrospector } from './introspectors/spec-engine.introspector';
import { RouteIntrospector } from './introspectors/route.introspector';
import { EntityIntrospector } from './introspectors/entity.introspector';
import { JobIntrospector } from './introspectors/job.introspector';
import { NotificationIntrospector } from './introspectors/notification.introspector';
import { MigrationIntrospector } from './introspectors/migration.introspector';
import { ErrorIntrospector } from './introspectors/error.introspector';
import { ModuleIntrospector } from './introspectors/module.introspector';
import { SearchCodeIntrospector } from './introspectors/search-code.introspector';
import { FrontendIntrospector } from './introspectors/frontend.introspector';
import { ToolRegistry, validateToolInput, type ToolDefinition, type IntrospectorBundle } from './tool-registry';
import type { ErrorView } from './types';

interface ToolListResponse {
  tools: Array<{ name: string; description: string; inputSchema: unknown }>;
}

interface ToolExecuteResponse {
  result: unknown;
}

@Controller('api/v1/_mcp')
export class McpController implements OnModuleInit {
  private readonly logger = new Logger('McpController');
  private registry!: ToolRegistry;

  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit(): void {
    const cache = new IntrospectionCache();
    const loadedSpecs = this.resolveLoadedSpecs();
    const dataSource = this.resolveDataSource();
    const migrationQueryFn = {
      async queryAppliedMigrations() { return [] as { id: number; name: string; timestamp: string | number; ranAt?: string }[]; },
    };
    const errorQueryFn = {
      async queryErrors() { return [] as ErrorView[]; },
    };
    const migrationsDir = process.env.MCP_MIGRATIONS_DIR
      ?? require('node:path').join(process.cwd(), 'apps/back/src/infrastructure/database/migrations');
    const bundle: IntrospectorBundle = {
      specEngine: new SpecEngineIntrospector(loadedSpecs, cache),
      route: new RouteIntrospector(loadedSpecs, cache),
      entity: new EntityIntrospector(loadedSpecs, cache),
      job: new JobIntrospector(loadedSpecs, cache),
      notification: new NotificationIntrospector(loadedSpecs, cache),
      migration: new MigrationIntrospector(cache, migrationQueryFn, migrationsDir),
      error: new ErrorIntrospector(cache, errorQueryFn),
      module: new ModuleIntrospector(cache),
      searchCode: new SearchCodeIntrospector(cache),
      frontend: new FrontendIntrospector(cache),
    };
    this.registry = new ToolRegistry(bundle, cache);
    this.logger.log(`MCP tools ready: ${this.registry.list().length} tools, ${loadedSpecs.length} extensions`);
  }

  @Get('tools')
  listTools(): ToolListResponse {
    const tools = this.registry.list().map((t: ToolDefinition) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
    return { tools };
  }

  @Post('tools/:name')
  @HttpCode(HttpStatus.OK)
  async executeTool(
    @Param('name') name: string,
    @Body() body: Record<string, unknown> | undefined,
  ): Promise<ToolExecuteResponse> {
    const tool = this.registry.get(name);
    if (!tool) {
      throw new NotFoundException(`Tool not found: ${name}`);
    }
    const args = body ?? {};
    const error = validateToolInput(tool, args);
    if (error) {
      throw new BadRequestException({ error, tool: name });
    }
    const result = await this.registry.execute(name, args);
    return { result };
  }

  private resolveLoadedSpecs(): LoadedSpec[] {
    try {
      const specs = this.moduleRef.get<LoadedSpec[]>('SPEC_LOADED_SPECS', { strict: false });
      return specs ?? [];
    } catch {
      return [];
    }
  }

  private resolveDataSource(): import('typeorm').DataSource | null {
    try {
      return this.moduleRef.get<import('typeorm').DataSource>('DataSource', { strict: false });
    } catch {
      return null;
    }
  }
}