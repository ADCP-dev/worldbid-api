import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NoteService } from './note.service';
import { NoteController } from './note.controller';
import { GraphService } from './graph.service';
import { GraphController } from './graph.controller';
import { NotePersistenceModule } from './infrastructure/persistence.module';
import { EmbeddingProcessor } from './infrastructure/embeddings/embedding.processor';

@Module({
  imports: [
    NotePersistenceModule,
    BullModule.registerQueue({ name: 'ka-embedding' }),
  ],
  controllers: [NoteController, GraphController],
  providers: [NoteService, GraphService, EmbeddingProcessor],
  exports: [NoteService, GraphService, NotePersistenceModule],
})
export class KnowledgeAgentExtensionModule {}