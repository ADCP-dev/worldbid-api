/**
 * MCP Introspection Server — stdio entry point (scaffold).
 *
 * Mode A: standalone process launched by an agent (Cursor/Claude Code/OpenCode).
 * Composes introspectors with a direct DataSource + repo path (no NestJS DI).
 *
 * TODO(user-gated): install `@modelcontextprotocol/sdk` and wire the MCP
 * protocol (ListToolsRequestSchema, CallToolRequestSchema, StdioServerTransport).
 * The introspectors and tool registry below are ready — only the SDK transport
 * adapter is pending the npm install.
 *
 * Usage after SDK install:
 *   npx ts-node apps/back/src/mcp/introspection-server.ts
 */

import 'dotenv/config';
import { DataSource } from 'typeorm';
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
import { ToolRegistry, type IntrospectorBundle } from './tool-registry';
import { SpecLoader } from '@core/spec-engine/spec-loader';
import type { LoadedSpec } from '@core/spec-engine/spec-loader';
import path from 'node:path';

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (!databaseUrl) {
    process.stderr.write('DATABASE_URL is required\n');
    process.exit(1);
  }

  const cache = new IntrospectionCache();
  const extensionsDir = path.join(repoRoot, 'apps/back/src/extensions');
  const loadedSpecs: LoadedSpec[] = SpecLoader.load(extensionsDir);

  const ds = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    logging: false,
  });
  await ds.initialize();

  const migrationQueryFn = {
    async queryAppliedMigrations() {
      const rows = await ds.query(
        'SELECT id, name, timestamp, ran_at FROM typeorm_migrations ORDER BY timestamp ASC',
      );
      return rows.map((r: { id: number; name: string; timestamp: string | number; ran_at?: string }) => ({
        id: r.id, name: r.name, timestamp: r.timestamp, ranAt: r.ran_at,
      }));
    },
  };
  const errorQueryFn = {
    async queryErrors(filter: { category?: string; extension?: string; resolved?: boolean; limit?: number }) {
      const limit = filter.limit ?? 10;
      const where: string[] = [];
      const params: unknown[] = [];
      if (filter.category) { where.push('category = $' + (params.length + 1)); params.push(filter.category); }
      if (filter.extension) { where.push('extension = $' + (params.length + 1)); params.push(filter.extension); }
      if (filter.resolved !== undefined) { where.push('resolved = $' + (params.length + 1)); params.push(filter.resolved); }
      const sql = `SELECT * FROM error_logs ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);
      return ds.query(sql, params);
    },
  };

  const bundle: IntrospectorBundle = {
    specEngine: new SpecEngineIntrospector(loadedSpecs, cache, repoRoot),
    route: new RouteIntrospector(loadedSpecs, cache),
    entity: new EntityIntrospector(loadedSpecs, cache),
    job: new JobIntrospector(loadedSpecs, cache),
    notification: new NotificationIntrospector(loadedSpecs, cache),
    migration: new MigrationIntrospector(
      cache, migrationQueryFn,
      path.join(repoRoot, 'apps/back/src/infrastructure/database/migrations'),
    ),
    error: new ErrorIntrospector(cache, errorQueryFn),
    module: new ModuleIntrospector(cache, repoRoot),
    searchCode: new SearchCodeIntrospector(cache, repoRoot),
    frontend: new FrontendIntrospector(cache, repoRoot),
  };
  const _registry = new ToolRegistry(bundle, cache);

  // TODO(user-gated): import { Server } from '@modelcontextprotocol/sdk/server/index.js';
  // import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
  // const server = new Server({ name: 'foundation-introspection', version: '1.0.0' }, { capabilities: { tools: {} } });
  // server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: _registry.list().map(...) }));
  // server.setRequestHandler(CallToolRequestSchema, async (req) => { ... _registry.execute(...) });
  // await server.connect(new StdioServerTransport());
  process.stderr.write('MCP introspection server scaffold ready — wire @modelcontextprotocol/sdk to activate\n');
  await ds.destroy();
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${(err as Error).message}\n`);
  process.exit(1);
});