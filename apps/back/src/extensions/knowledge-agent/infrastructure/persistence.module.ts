import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NoteRepository } from './note.repository';
import { NoteEntity } from './entities/note.entity';
import { NoteLinkEntity } from './entities/note-link.entity';
import { AgentConfigEntity } from './entities/agent-config.entity';
import { ModelProviderEntity } from './entities/model-provider.entity';
import { ModelEntity } from './entities/model.entity';
import { McpServerEntity } from './entities/mcp-server.entity';
import { ChatSessionEntity } from './entities/chat-session.entity';
import { AgentConfigRepository } from './agent-config.repository';
import { ModelProviderRepository } from './model-provider.repository';
import { ModelRepository } from './model.repository';
import { McpServerRepository } from './mcp-server.repository';
import { ChatSessionRepository } from './chat-session.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NoteEntity,
      NoteLinkEntity,
      AgentConfigEntity,
      ModelProviderEntity,
      ModelEntity,
      McpServerEntity,
      ChatSessionEntity,
    ]),
  ],
  providers: [
    NoteRepository,
    AgentConfigRepository,
    ModelProviderRepository,
    ModelRepository,
    McpServerRepository,
    ChatSessionRepository,
  ],
  exports: [
    NoteRepository,
    AgentConfigRepository,
    ModelProviderRepository,
    ModelRepository,
    McpServerRepository,
    ChatSessionRepository,
  ],
})
export class NotePersistenceModule {}