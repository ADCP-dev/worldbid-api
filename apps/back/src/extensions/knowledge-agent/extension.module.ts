import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { NoteService } from './note.service';
import { NoteController } from './note.controller';
import { GraphService } from './graph.service';
import { GraphController } from './graph.controller';
import { AgentConfigController } from './agent-config.controller';
import { ModelProviderController } from './model-provider.controller';
import { ModelController } from './model.controller';
import { McpServerController } from './mcp-server.controller';
import { NotePersistenceModule } from './infrastructure/persistence.module';
import { EmbeddingProcessor } from './infrastructure/embeddings/embedding.processor';
import { EmbeddingsService } from './infrastructure/embeddings/embeddings.service';
import { VectorStoreService } from './infrastructure/vector-store.service';
import { RagService } from './infrastructure/rag.service';
import { AgentFactoryService } from './infrastructure/agent/agent-factory.service';
import { ToolRegistryService } from './infrastructure/agent/tool-registry.service';
import { McpLoaderService } from './infrastructure/agent/mcp-loader.service';
import { SandboxService } from './infrastructure/agent/sandbox.service';
import kaConfig from './config/knowledge-agent.config';
import { KnowledgeAgentSeedModule } from './seeds/knowledge-agent-seed.module';

@Module({
  imports: [
    ConfigModule.forFeature(kaConfig),
    NotePersistenceModule,
    BullModule.registerQueue({ name: 'ka-embedding' }),
    KnowledgeAgentSeedModule,
  ],
  controllers: [
    NoteController,
    GraphController,
    AgentConfigController,
    ModelProviderController,
    ModelController,
    McpServerController,
  ],
  providers: [
    NoteService,
    GraphService,
    EmbeddingsService,
    VectorStoreService,
    RagService,
    EmbeddingProcessor,
    AgentFactoryService,
    ToolRegistryService,
    McpLoaderService,
    SandboxService,
  ],
  exports: [
    NoteService,
    GraphService,
    EmbeddingsService,
    VectorStoreService,
    RagService,
    AgentFactoryService,
    ToolRegistryService,
    McpLoaderService,
    SandboxService,
    NotePersistenceModule,
  ],
})
export class KnowledgeAgentExtensionModule {}