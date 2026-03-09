import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileEntity } from '@storage/files/infrastructure/entities/file.entity';
import { FileRepository } from '@storage/files/infrastructure/file.repository';
import { GlobalFileCleanupSubscriber } from '@storage/files/infrastructure/subscribers/global-file-cleanup.subscriber';
import { FileCleanupErrorEntity } from '@storage/files/infrastructure/entities/file-cleanup-error.entity';
import { FileCleanupErrorRepository } from '@storage/files/infrastructure/file-cleanup-error.repository';

@Module({
  imports: [TypeOrmModule.forFeature([FileEntity, FileCleanupErrorEntity])],
  providers: [
    FileRepository,
    GlobalFileCleanupSubscriber,
    FileCleanupErrorRepository,
  ],
  exports: [FileRepository, FileCleanupErrorRepository],
})
export class FilePersistenceModule {}
