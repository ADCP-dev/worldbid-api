import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NoteRepository } from './note.repository';
import { NoteEntity } from './entities/note.entity';
import { NoteLinkEntity } from './entities/note-link.entity';

@Module({
  imports: [TypeOrmModule.forFeature([NoteEntity, NoteLinkEntity])],
  providers: [NoteRepository],
  exports: [NoteRepository],
})
export class NotePersistenceModule {}