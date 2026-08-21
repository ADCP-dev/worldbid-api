import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NoteService } from './note.service';
import { NoteController } from './note.controller';
import { NotePersistenceModule } from './infrastructure/persistence.module';
import { EmbeddingProcessor } from './infrastructure/embeddings/embedding.processor';

@Module({
  imports: [
    NotePersistenceModule,
    BullModule.registerQueue({ name: 'ka-embedding' }),
  ],
  controllers: [NoteController],
  providers: [NoteService, EmbeddingProcessor],
  exports: [NoteService, NotePersistenceModule],
})
export class KnowledgeAgentExtensionModule {}