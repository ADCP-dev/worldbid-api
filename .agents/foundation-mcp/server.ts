#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerIntrospectionTools } from './tools/introspection.js';
import { registerMigrationTools } from './tools/migrations.js';
import { registerGeneratorTools } from './tools/generators.js';
import { registerMaizzleTools } from './tools/maizzle.js';
import { registerTranslationTools } from './tools/translations.js';
import { registerSeedTools } from './tools/seeds.js';
import { registerQualityTools } from './tools/quality.js';
import { registerCrossRefTools } from './tools/crossref.js';

const server = new McpServer({
  name: 'foundation-mcp',
  version: '0.1.0',
});

registerIntrospectionTools(server);
registerMigrationTools(server);
registerGeneratorTools(server);
registerMaizzleTools(server);
registerTranslationTools(server);
registerSeedTools(server);
registerQualityTools(server);
registerCrossRefTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);

console.error('[foundation-mcp] connected via stdio');
