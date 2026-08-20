/**
 * McpModule — NestJS module for the MCP introspection HTTP transport.
 *
 * The controller resolves the loaded specs via ModuleRef in onModuleInit
 * (token 'SPEC_LOADED_SPECS' exported by SpecEngineModule) and builds the
 * full introspector bundle + tool registry. This avoids static provider
 * ordering coupling with SpecEngineModule.register().
 */

import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';

@Module({
  controllers: [McpController],
})
export class McpModule {}