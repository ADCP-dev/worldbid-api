import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  RemoveEvent,
} from 'typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { FileEntity } from '@storage/files/infrastructure/entities/file.entity';
import { FilesLocalService } from '@storage/files/infrastructure/uploader/local/files.service';
import { FileCleanupErrorRepository } from '@storage/files/infrastructure/file-cleanup-error.repository';

@Injectable()
@EventSubscriber()
export class FileLocalSubscriber
  implements EntitySubscriberInterface<FileEntity>
{
  private readonly logger = new Logger(FileLocalSubscriber.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly filesLocalService: FilesLocalService,
    private readonly fileCleanupErrorRepository: FileCleanupErrorRepository,
  ) {
    this.dataSource.subscribers.push(this);
  }

  listenTo() {
    return FileEntity;
  }

  async afterRemove(event: RemoveEvent<FileEntity>) {
    const file = event.entity;

    // We only need to delete from local disk if the driver is local,
    // which is implicitly true because we're injecting FilesLocalService.
    if (file && file.path) {
      try {
        this.filesLocalService.deletePhysicalFile(file.path);
        this.logger.log(`File ${file.path} deleted locally successfully.`);
      } catch (error) {
        this.logger.error(
          `Error deleting file ${file.path} locally, queuing for retry:`,
          error.stack,
        );

        await this.fileCleanupErrorRepository.save({
          fileUri: file.path,
          driver: 'local',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
